import { AppError } from '@make-it-ai/shared';
import type { ProviderRegistry } from './provider-registry';
import type { Candidate, GatewayConfig, GenerationRequest, StreamChunk } from './types';

export interface StreamDependencies {
  config: GatewayConfig;
  providers: ProviderRegistry;
  candidates: (request: GenerationRequest) => Candidate[];
}

export async function* managedStream(
  request: GenerationRequest,
  dependencies: StreamDependencies,
): AsyncGenerator<StreamChunk> {
  const { config, providers } = dependencies;
  const candidates = dependencies.candidates(request);
  const failures: string[] = [];

  for (const candidate of candidates) {
    const adapter = providers.get(candidate.provider);
    if (!adapter) continue;
    const apiKey = candidate.provider === 'local-rules' ? undefined : config.apiKeys[candidate.provider];
    if (candidate.provider !== 'local-rules' && !apiKey) continue;

    let emitted = false;
    try {
      for await (const chunk of adapter.stream({ ...request, provider: candidate.provider, model: candidate.model }, apiKey)) {
        emitted = true;
        yield chunk;
      }
      if (emitted) return;
      failures.push(`${candidate.provider}/${candidate.model}: empty stream`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${candidate.provider}/${candidate.model}: ${message.slice(0, 200)}`);
      if (emitted) {
        yield {
          delta: `\n\n[stream interrupted: ${message.slice(0, 160)}]`,
          provider: candidate.provider,
          model: candidate.model,
          done: true,
        };
        return;
      }
    }
  }

  throw new AppError('PROVIDER_UNAVAILABLE', 'No provider could start a stream', failures);
}
