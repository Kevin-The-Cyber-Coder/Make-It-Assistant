import {
  AGENT_EVENTS,
  AppError,
  type AgentTask,
  type ID,
  type PlanStep,
  type ProjectFile,
  type TaskType,
} from '@make-it-ai/shared';
import type { Repositories } from '@make-it-ai/database';
import { createPlan, planningEvent } from './planner';
import { SPECIALISTS } from './specialists';
import { TaskManager } from './task-manager';
import { ToolRegistry } from './tool-registry';
import type { AgentContext } from './types';
import { WorkflowEngine } from './workflow-engine';

export interface StartTaskInput {
  organizationId: ID;
  userId: ID;
  objective: string;
  projectId?: ID;
  autoApprove?: boolean;
}

export interface OrchestratorDependencies {
  repositories: Repositories;
  chat: (prompt: string, taskType: TaskType, files: ProjectFile[], metadata?: Record<string, unknown>) => Promise<string>;
  filesForProject?: (projectId?: ID) => Promise<ProjectFile[]>;
  executor?: AgentContext['executor'];
}

export class Orchestrator {
  readonly tasks: TaskManager;
  readonly tools = new ToolRegistry();
  private readonly workflow = new WorkflowEngine();

  constructor(private readonly dependencies: OrchestratorDependencies) {
    this.tasks = new TaskManager(dependencies.repositories);
  }

  async start(input: StartTaskInput): Promise<AgentTask> {
    const files = (await this.dependencies.filesForProject?.(input.projectId)) ?? [];
    const plan = createPlan(input.objective, files);
    const task = await this.tasks.create({
      organizationId: input.organizationId,
      userId: input.userId,
      objective: input.objective,
      projectId: input.projectId,
      plan,
    });

    void this.run(task, files, Boolean(input.autoApprove)).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      void this.tasks.emit(task.id, task.organizationId, AGENT_EVENTS.TASK_FAILED, message);
    });
    return task;
  }

  private async run(task: AgentTask, files: ProjectFile[], autoApprove: boolean): Promise<void> {
    const controller = this.tasks.controller(task.id);
    await this.tasks.update(task.id, { status: 'planning' });
    const planEvent = planningEvent(task.id, task.organizationId, task.plan);
    await this.tasks.emit(
      task.id,
      task.organizationId,
      planEvent.type,
      planEvent.message,
      planEvent.payload,
    );

    try {
      await this.workflow.execute(
        task.plan,
        async (step: PlanStep) => {
          controller.signal.throwIfAborted();
          await this.markStep(task, step, 'running');
          await this.tasks.emit(task.id, task.organizationId, AGENT_EVENTS.TASK_RUNNING, `Running: ${step.title}`, {
            stepId: step.id,
            agent: step.agent,
          });

          if (step.requiresApproval && !autoApprove) {
            await this.markStep(task, step, 'awaiting_approval');
            await this.tasks.emit(
              task.id,
              task.organizationId,
              AGENT_EVENTS.APPROVAL_REQUIRED,
              `Approval required: ${step.title}`,
              { stepId: step.id, agent: step.agent, description: step.description },
            );
            const approved = await this.tasks.waitForApproval(task.id, step.id);
            step.approved = approved;
            if (!approved) {
              await this.markStep(task, step, 'skipped');
              return;
            }
          }

          const artifacts: AgentContext['artifacts'] = [];
          const context: AgentContext = {
            organizationId: task.organizationId,
            userId: task.userId,
            taskId: task.id,
            projectId: task.projectId,
            objective: task.objective,
            files,
            plan: task.plan,
            artifacts,
            signal: controller.signal,
            executor: this.dependencies.executor,
            chat: (prompt, taskType, metadata) =>
              this.dependencies.chat(prompt, taskType, files, {
                ...metadata,
                organizationId: task.organizationId,
                userId: task.userId,
              }),
            emit: (type, message, payload) => {
              void this.tasks.emit(task.id, task.organizationId, type as AgentEventType, message, payload);
            },
            requestApproval: async (_step, action, details) => {
              await this.tasks.emit(task.id, task.organizationId, AGENT_EVENTS.APPROVAL_REQUIRED, `Approval required: ${action}`, {
                stepId: step.id,
                details,
              });
              if (autoApprove) return true;
              return this.tasks.waitForApproval(task.id, step.id);
            },
          };

          const specialist = SPECIALISTS[step.agent] ?? SPECIALISTS.orchestrator;
          const output = await specialist.run(context, step);
          artifacts.push(...output.artifacts);
          await this.markStep(task, step, 'done', output.summary.slice(0, 4000));
          await this.tasks.emit(task.id, task.organizationId, AGENT_EVENTS.TOOL_COMPLETED, `Completed: ${step.title}`, {
            stepId: step.id,
            artifactCount: output.artifacts.length,
            findings: output.findings?.slice(0, 20),
          });
        },
        () => controller.signal.aborted,
      );

      const result = task.plan
        .filter((step) => step.status === 'done')
        .map((step) => `## ${step.title}\n${step.output ?? ''}`)
        .join('\n\n');
      await this.tasks.update(task.id, { status: 'completed', result, plan: task.plan });
      await this.tasks.emit(task.id, task.organizationId, AGENT_EVENTS.TASK_COMPLETED, 'Task completed', {
        steps: task.plan.length,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        await this.tasks.update(task.id, { status: 'cancelled' });
        await this.tasks.emit(task.id, task.organizationId, AGENT_EVENTS.TASK_CANCELLED, 'Task cancelled');
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      await this.tasks.update(task.id, { status: 'failed', error: message });
      await this.tasks.emit(task.id, task.organizationId, AGENT_EVENTS.TASK_FAILED, message);
    }
  }

  private async markStep(task: AgentTask, step: PlanStep, status: PlanStep['status'], output?: string): Promise<void> {
    step.status = status;
    if (output) step.output = output;
    await this.tasks.update(
      task.id,
      status === 'running' ? { plan: task.plan, status: 'running' } : { plan: task.plan },
    );
  }

  async approve(organizationId: ID, taskId: ID, stepId: ID, approved: boolean): Promise<AgentTask> {
    const task = await this.tasks.get(organizationId, taskId);
    if (!task) throw new AppError('NOT_FOUND', 'Task not found');
    const step = task.plan.find((item) => item.id === stepId);
    if (!step) throw new AppError('NOT_FOUND', 'Plan step not found');
    this.tasks.resolveApproval(taskId, stepId, approved);
    return task;
  }

  async cancel(organizationId: ID, taskId: ID): Promise<AgentTask> {
    return this.tasks.cancel(organizationId, taskId);
  }
}

// Imported as a type-only alias to keep the event union in one place.
type AgentEventType = import('@make-it-ai/shared').AgentEventType;
