import type { StreamChunk, StreamUsageSummary } from './types';

/**
 * Accumulates token accounting across streamed chunks. Provider-reported
 * usage wins when present; otherwise tokens are estimated at four characters
 * per token, which is explicitly reported as an estimate.
 */
export class StreamUsageTracker {
  private provider = 'local-rules';
  private model = 'unknown';
  private promptTokens = 0;
  private completionTokens = 0;
  private chunkCount = 0;
  private deltaChars = 0;
  private firstTokenAt: number | null = null;
  private providerReported = false;
  private readonly startedAt = Date.now();

  constructor(private readonly identity: { organizationId?: string; userId?: string } = {}) {}

  observe(chunk: StreamChunk): void {
    if (chunk.provider) this.provider = chunk.provider;
    if (chunk.model) this.model = chunk.model;
    this.chunkCount += 1;
    if (chunk.delta) {
      this.deltaChars += chunk.delta.length;
      if (this.firstTokenAt === null) this.firstTokenAt = Date.now();
    }
    if (chunk.usage) {
      this.providerReported = true;
      this.promptTokens = Math.max(this.promptTokens, chunk.usage.promptTokens ?? 0);
      this.completionTokens = Math.max(this.completionTokens, chunk.usage.completionTokens ?? 0);
    }
  }

  summary(promptChars = 0, success = true): StreamUsageSummary {
    const promptTokens = this.providerReported
      ? this.promptTokens
      : Math.ceil(promptChars / 4);
    const completionTokens = this.providerReported
      ? this.completionTokens
      : Math.ceil(this.deltaChars / 4);
    return {
      provider: this.provider,
      model: this.model,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      chunkCount: this.chunkCount,
      firstTokenMs: this.firstTokenAt === null ? 0 : this.firstTokenAt - this.startedAt,
      durationMs: Date.now() - this.startedAt,
      estimated: !this.providerReported,
      success,
      organizationId: this.identity.organizationId,
      userId: this.identity.userId,
    };
  }
}
