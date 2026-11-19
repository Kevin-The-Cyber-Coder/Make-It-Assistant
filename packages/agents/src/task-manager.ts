import { AGENT_EVENTS, AppError, type AgentEvent, type AgentTask, type ID } from '@make-it-ai/shared';
import type { Repositories } from '@make-it-ai/database';

export interface CreateTaskInput {
  organizationId: ID;
  userId: ID;
  objective: string;
  projectId?: ID;
  plan: AgentTask['plan'];
}

export class TaskManager {
  private readonly controllers = new Map<ID, AbortController>();
  private readonly approvals = new Map<string, (approved: boolean) => void>();
  private readonly preApprovals = new Map<string, boolean>();

  constructor(private readonly repositories: Repositories) {}

  async create(input: CreateTaskInput): Promise<AgentTask> {
    const now = new Date().toISOString();
    const task: AgentTask = {
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      userId: input.userId,
      projectId: input.projectId,
      objective: input.objective,
      status: 'created',
      plan: input.plan,
      createdAt: now,
      updatedAt: now,
    };
    await this.repositories.agentTasks.create(task);
    await this.emit(task.id, task.organizationId, AGENT_EVENTS.TASK_CREATED, 'Agent task created', {
      objective: task.objective,
    });
    return task;
  }

  async get(organizationId: ID, taskId: ID): Promise<AgentTask | null> {
    const task = await this.repositories.agentTasks.findById(taskId);
    return task && task.organizationId === organizationId ? task : null;
  }

  async list(organizationId: ID, limit = 50): Promise<AgentTask[]> {
    return this.repositories.agentTasks.find({
      where: { organizationId },
      sort: { field: 'createdAt', direction: 'desc' },
      limit,
    });
  }

  async update(taskId: ID, patch: Partial<AgentTask>): Promise<AgentTask | null> {
    return this.repositories.agentTasks.update(taskId, { ...patch, updatedAt: new Date().toISOString() });
  }

  async emit(
    taskId: ID,
    organizationId: ID,
    type: AgentEvent['type'],
    message: string,
    payload?: Record<string, unknown>,
  ): Promise<AgentEvent> {
    const event: AgentEvent = {
      id: crypto.randomUUID(),
      organizationId,
      taskId,
      type,
      message,
      payload,
      createdAt: new Date().toISOString(),
    };
    await this.repositories.agentEvents.create(event);
    return event;
  }

  async events(organizationId: ID, taskId?: ID, limit = 200): Promise<AgentEvent[]> {
    return this.repositories.agentEvents.find({
      where: taskId ? { organizationId, taskId } : { organizationId },
      sort: { field: 'createdAt', direction: 'asc' },
      limit,
    });
  }

  controller(taskId: ID): AbortController {
    if (!this.controllers.has(taskId)) this.controllers.set(taskId, new AbortController());
    return this.controllers.get(taskId)!;
  }

  async cancel(organizationId: ID, taskId: ID): Promise<AgentTask> {
    const task = await this.get(organizationId, taskId);
    if (!task) throw new AppError('NOT_FOUND', 'Task not found');
    this.controller(taskId).abort();
    const updated = await this.update(taskId, { status: 'cancelled' });
    await this.emit(taskId, organizationId, AGENT_EVENTS.TASK_CANCELLED, 'Task cancelled by user');
    return updated!;
  }

  waitForApproval(taskId: ID, stepId: ID): Promise<boolean> {
    const key = `${taskId}:${stepId}`;
    const preResolved = this.preApprovals.get(key);
    if (preResolved !== undefined) {
      this.preApprovals.delete(key);
      return Promise.resolve(preResolved);
    }
    return new Promise<boolean>((resolve) => this.approvals.set(key, resolve));
  }

  resolveApproval(taskId: ID, stepId: ID, approved: boolean): boolean {
    const key = `${taskId}:${stepId}`;
    const resolve = this.approvals.get(key);
    if (resolve) {
      this.approvals.delete(key);
      resolve(approved);
      return true;
    }
    this.preApprovals.set(key, approved);
    return true;
  }
}
