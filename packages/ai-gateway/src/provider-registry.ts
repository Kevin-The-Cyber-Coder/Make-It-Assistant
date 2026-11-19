import type { GatewayConfig, ModelInfo, ProviderAdapter, ProviderId } from './types';
import { OpenAIAdapter } from './adapters/openai';
import { AnthropicAdapter } from './adapters/anthropic';
import { GeminiAdapter } from './adapters/gemini';
import { LocalRulesAdapter } from './adapters/local-rules';

export class ProviderRegistry {
  private readonly adapters = new Map<ProviderId, ProviderAdapter>();

  register(adapter: ProviderAdapter): this {
    this.adapters.set(adapter.id, adapter);
    return this;
  }

  get(id: ProviderId): ProviderAdapter | undefined {
    return this.adapters.get(id);
  }

  all(): ProviderAdapter[] {
    return [...this.adapters.values()];
  }

  ids(): ProviderId[] {
    return [...this.adapters.keys()];
  }

  listModels(): ModelInfo[] {
    return this.all().flatMap((adapter) => adapter.listModels());
  }

  hasCredentials(id: ProviderId, config: GatewayConfig): boolean {
    if (id === 'local-rules') return config.enableLocalFallback;
    return Boolean(config.apiKeys[id]);
  }

  async health(id: ProviderId, config: GatewayConfig): Promise<'available' | 'unavailable' | 'no-credentials'> {
    const adapter = this.adapters.get(id);
    if (!adapter) return 'unavailable';
    if (!this.hasCredentials(id, config)) return 'no-credentials';
    if (!adapter.healthCheck) return 'available';
    try {
      return (await adapter.healthCheck(config.apiKeys[id])) ? 'available' : 'unavailable';
    } catch {
      return 'unavailable';
    }
  }
}

export function createDefaultRegistry(config: GatewayConfig): ProviderRegistry {
  return new ProviderRegistry()
    .register(new OpenAIAdapter(config.baseUrls?.openai))
    .register(new AnthropicAdapter(config.baseUrls?.anthropic))
    .register(new GeminiAdapter(config.baseUrls?.gemini))
    .register(new LocalRulesAdapter());
}
