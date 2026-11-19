import type { PlanStep } from '@make-it-ai/shared';

export class WorkflowEngine {
  constructor(private readonly maxAttempts = 2) {}

  async execute(
    steps: PlanStep[],
    run: (step: PlanStep) => Promise<void>,
    isCancelled: () => boolean = () => false,
  ): Promise<void> {
    for (const step of steps) {
      if (isCancelled()) return;
      let lastError: unknown;
      for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
        if (isCancelled()) return;
        try {
          await run(step);
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
          if (isCancelled()) return;
        }
      }
      if (lastError) throw lastError;
    }
  }
}
