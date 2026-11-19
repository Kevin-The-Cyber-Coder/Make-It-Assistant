import { AppError } from '@make-it-ai/shared';
import type { ProviderRegistry } from './provider-registry';
import type { Candidate, GatewayConfig } from './types';

export interface FallbackResult<T> {
  value: T;
  candidate: Candidate;
  attempts: Array<{ candidate: Candidate; error: string }>;
}

export class FallbackManager {
  constructor(
    private readonly providers: ProviderRegistry,
    private readonly config: GatewayConfig,
  ) {}

  async execute<T>(
    candidates: Candidate[],
    run: (candidate: Candidate, apiKey?: string) => Promise<T>,
  ): Promise<FallbackResult<T>> {
    if (candidates.length === 0) {
      throw new AppError('PROVIDER_UNAVAILABLE', 'No AI provider is configured. Set an API key or enable the local rule engine.');
    }
    const attempts: Array<{ candidate: Candidate; error: string }> = [];
    for (const candidate of candidates) {
      const adapter = this.providers.get(candidate.provider);
      if (!adapter) continue;
      const apiKey = candidate.provider === 'local-rules' ? undefined : this.config.apiKeys[candidate.provider];
      if (candidate.provider !== 'local-rules' && !apiKey) continue;
      this.config.onEvent?.({
        type: 'ai:provider:attempt',
        message: `Attempting ${candidate.provider}/${candidate.model}`,
        metadata: { provider: candidate.provider, model: candidate.model },
      });
      try {
        const value = await run(candidate, apiKey);
        return { value, candidate, attempts };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        attempts.push({ candidate, error: message.slice(0, 400) });
        this.config.onEvent?.({
          type: 'ai:provider:failed',
          message: `${candidate.provider}/${candidate.model} failed: ${message.slice(0, 200)}`,
          metadata: { provider: candidate.provider, model: candidate.model },
        });
      }
    }
    throw new AppError('PROVIDER_UNAVAILABLE', 'All configured AI providers failed', attempts);
  }
}
