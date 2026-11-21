import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { AppError, approvalSchema, taskCreateSchema } from '@make-it-ai/shared';
import type { ProjectFile } from '@make-it-ai/shared';
import type { AppContext } from '../../context';
import { audit } from '../../lib/audit';
import { requireAuth, validate } from '../../middleware';

export function createAgentRouter(context: AppContext): Router {
  const router = Router();
  router.use(requireAuth(context));

  router.post('/tasks', validate(taskCreateSchema), async (request, response) => {
    const input = request.body as ReturnType<typeof taskCreateSchema.parse>;
    const files: ProjectFile[] = input.projectId ? context.indexes.get(input.projectId)?.files ?? [] : [];
    const task = await context.orchestrator.start({
      organizationId: request.actor!.organizationId,
      userId: request.actor!.userId,
      objective: input.objective,
      projectId: input.projectId,
      autoApprove: input.autoApprove,
    });
    await audit(context, request, 'agent.task.create', 'agent_task', task.id);
    response.status(201).json({ task });
  });

  router.get('/tasks', async (request, response) => {
    const tasks = await context.orchestrator.tasks.list(request.actor!.organizationId);
    response.json({ tasks });
  });

  router.get('/metrics', async (request, response) => {
    const tasks = await context.orchestrator.tasks.list(request.actor!.organizationId);
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const byStatus: Record<string, number> = {};
    let completedLast24h = 0;
    let failedLast24h = 0;
    let completedDurationTotal = 0;
    let completedDurationCount = 0;

    for (const task of tasks) {
      byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
      const updatedAt = Date.parse(task.updatedAt);
      if (task.status === 'completed' && updatedAt >= dayAgo) completedLast24h += 1;
      if (task.status === 'failed' && updatedAt >= dayAgo) failedLast24h += 1;
      if (task.status === 'completed') {
        const createdAt = Date.parse(task.createdAt);
        if (Number.isFinite(createdAt) && Number.isFinite(updatedAt) && updatedAt >= createdAt) {
          completedDurationTotal += updatedAt - createdAt;
          completedDurationCount += 1;
        }
      }
    }

    response.json({
      metrics: {
        total: tasks.length,
        byStatus,
        completedLast24h,
        failedLast24h,
        awaitingApproval: byStatus.awaiting_approval ?? 0,
        running: byStatus.running ?? 0,
        avgCompletionMs: completedDurationCount ? Math.round(completedDurationTotal / completedDurationCount) : null,
      },
    });
  });

  router.get('/tasks/:id', async (request, response) => {
    const task = await context.orchestrator.tasks.get(request.actor!.organizationId, request.params.id);
    if (!task) throw new AppError('NOT_FOUND', 'Task not found');
    response.json({ task });
  });

  router.post('/tasks/:id/approve', validate(approvalSchema), async (request, response) => {
    const input = request.body as ReturnType<typeof approvalSchema.parse>;
    const task = await context.orchestrator.approve(
      request.actor!.organizationId,
      request.params.id,
      input.stepId,
      input.approved,
    );
    await audit(context, request, input.approved ? 'agent.approve' : 'agent.reject', 'agent_task', task.id, {
      stepId: input.stepId,
      note: input.note,
    });
    response.json({ task });
  });

  router.post('/tasks/:id/cancel', async (request, response) => {
    const task = await context.orchestrator.cancel(request.actor!.organizationId, request.params.id);
    await audit(context, request, 'agent.cancel', 'agent_task', task.id);
    response.json({ task });
  });

  router.get('/tasks/:id/events', async (request, response) => {
    const events = await context.orchestrator.tasks.events(
      request.actor!.organizationId,
      request.params.id,
    );
    response.json({ events });
  });

  router.get('/events', (request, response) => {
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.flushHeaders();
    response.write(`event: connected\ndata: ${JSON.stringify({ organizationId: request.actor!.organizationId })}\n\n`);
    const unsubscribe = context.bus.subscribe((event) => {
      if (event.organizationId !== request.actor!.organizationId) return;
      const taskId = String(request.query.taskId ?? '');
      if (taskId && event.taskId !== taskId) return;
      response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });
    request.on('close', unsubscribe);
  });

  router.get('/queue', async (_request, response) => {
    response.json({ mode: context.queue.mode, length: await context.queue.length() });
  });

  router.post('/queue', async (request, response) => {
    const type = String(request.body?.type ?? '').trim();
    const payload: unknown = request.body?.payload;
    if (!type) throw new AppError('BAD_REQUEST', 'type is required');
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new AppError('BAD_REQUEST', 'payload must be an object');
    }
    const task = {
      id: `queue_${randomUUID()}`,
      type,
      payload: payload as Record<string, unknown>,
      createdAt: new Date().toISOString(),
    };
    await context.queue.enqueue(task);
    await audit(context, request, 'agent.queue.enqueue', 'agent_queue_task', task.id, { type });
    response.status(201).json({ task });
  });

  router.post('/queue/dequeue', async (request, response) => {
    const task = await context.queue.dequeue();
    if (!task) throw new AppError('NOT_FOUND', 'Queue is empty');
    await audit(context, request, 'agent.queue.dequeue', 'agent_queue_task', task.id);
    response.json({ task });
  });

  return router;
}
