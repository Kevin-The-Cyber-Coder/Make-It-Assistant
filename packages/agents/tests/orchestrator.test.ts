import { createMemoryRepositories } from '@make-it-ai/database';
import { describe, expect, it, vi } from 'vitest';
import { Orchestrator } from '../src/orchestrator';

async function waitFor<T>(
  read: () => Promise<T | null | undefined>,
  predicate: (value: T) => boolean,
  timeoutMs = 3000,
): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await read();
    if (value !== null && value !== undefined && predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for orchestrator state');
}

describe('Orchestrator', () => {
  it('requires explicit approval before executing a sensitive step', async () => {
    const repositories = createMemoryRepositories();
    const chat = vi.fn().mockResolvedValue('model output');
    const orchestrator = new Orchestrator({
      repositories,
      chat,
      filesForProject: async () => [],
    });

    const task = await orchestrator.start({
      organizationId: 'org_test',
      userId: 'usr_test',
      objective: 'Implement a secure feature and document it',
    });

    const awaiting = await waitFor(
      () => repositories.agentTasks.findById(task.id),
      (current) => current?.plan.some((step) => step.status === 'awaiting_approval') ?? false,
    );
    const pendingStep = awaiting.plan.find((step) => step.status === 'awaiting_approval');
    expect(pendingStep?.agent).toBe('developer');
    expect(chat).not.toHaveBeenCalled();

    await orchestrator.approve('org_test', task.id, pendingStep!.id, true);
    const completed = await waitFor(
      () => repositories.agentTasks.findById(task.id),
      (current) => current?.status === 'completed' || current?.status === 'failed',
    );
    expect(completed.status).toBe('completed');
    expect(chat).toHaveBeenCalled();
    expect(completed.result).toContain('Implement changes');
  });
});
