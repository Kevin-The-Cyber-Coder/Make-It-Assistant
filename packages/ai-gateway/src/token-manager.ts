import type { ChatMessage, TokenUsage } from './types';

export class TokenManager {
  constructor(private readonly maxContextTokens = 32_000) {}

  estimate(text: string): number {
    return Math.ceil(text.length / 4);
  }

  estimateMessages(messages: ChatMessage[]): number {
    return messages.reduce((total, message) => total + this.estimate(message.content) + 4, 0);
  }

  fitMessages(messages: ChatMessage[], reservedOutputTokens = 2048): ChatMessage[] {
    const budget = Math.max(1024, this.maxContextTokens - reservedOutputTokens);
    const system = messages.filter((message) => message.role === 'system');
    const conversation = messages.filter((message) => message.role !== 'system');
    const selected: ChatMessage[] = [];
    let used = this.estimateMessages(system);

    for (let index = conversation.length - 1; index >= 0; index -= 1) {
      const message = conversation[index];
      const cost = this.estimate(message.content) + 4;
      if (used + cost > budget) break;
      selected.unshift(message);
      used += cost;
    }
    return [...system, ...selected];
  }

  clamp(maxTokens: number | undefined, fallback: number): number {
    if (!maxTokens || !Number.isFinite(maxTokens)) return fallback;
    return Math.min(Math.max(1, Math.floor(maxTokens)), 32_000);
  }

  mergeUsage(...usages: Array<TokenUsage | undefined>): TokenUsage {
    return usages.reduce<TokenUsage>(
      (total, usage) => ({
        promptTokens: total.promptTokens + (usage?.promptTokens ?? 0),
        completionTokens: total.completionTokens + (usage?.completionTokens ?? 0),
        totalTokens: total.totalTokens + (usage?.totalTokens ?? 0),
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    );
  }
}
