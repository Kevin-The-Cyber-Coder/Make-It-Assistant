import type { CapabilityRegistry } from './capability-registry';
import type { ProviderRegistry } from './provider-registry';
import type { Candidate, GatewayConfig, GenerationRequest } from './types';

export class ModelRouter {
  constructor(
    private readonly providers: ProviderRegistry,
    private readonly capabilities: CapabilityRegistry,
    private readonly config: GatewayConfig,
  ) {}

  candidates(request: GenerationRequest): Candidate[] {
    const taskType = request.taskType ?? 'general';
    const wantedProvider = request.provider;
    const available = this.providers.ids().filter((id) => this.providers.hasCredentials(id, this.config));
    const providers = wantedProvider ? available.filter((id) => id === wantedProvider) : available;

    const candidates: Candidate[] = [];
    for (const provider of providers) {
      for (const model of this.providers.get(provider)?.listModels() ?? []) {
        if (request.model && model.id !== request.model) continue;
        const score = this.capabilities.score(model, taskType);
        const required = this.capabilities.requiredCapabilities(taskType);
        candidates.push({
          provider,
          model: model.id,
          score,
          reason: score >= 0.99
            ? `satisfies ${required.join(', ') || 'general'} capabilities`
            : `partial capability match (${Math.round(score * 100)}%)`,
        });
      }
    }

    const order = new Map(this.config.fallbackOrder.map((id, index) => [id, index]));
    return candidates.sort((a, b) => {
      const scoreDelta = b.score - a.score;
      if (Math.abs(scoreDelta) > 0.001) return scoreDelta;
      return (order.get(a.provider) ?? 99) - (order.get(b.provider) ?? 99);
    });
  }
}
