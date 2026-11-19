import { CapabilityRegistry } from '../capability-registry';
import type {
  GenerationRequest,
  GenerationResponse,
  ProviderAdapter,
  StreamChunk,
  TokenUsage,
} from '../types';
import { parseSSE, safeJson } from './sse';

const capabilities = new CapabilityRegistry();

export class OpenAIAdapter implements ProviderAdapter {
  readonly id = 'openai' as const;
  private readonly baseUrl: string;

  constructor(baseUrl = 'https://api.openai.com/v1') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  listModels() {
    return capabilities.list('openai');
  }

  async healthCheck(apiKey?: string): Promise<boolean> {
    if (!apiKey) return false;
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  }

  private resolveModel(request: GenerationRequest): string {
    if (request.model) return request.model;
    if (request.taskType === 'security' || request.taskType === 'debug') return 'gpt-4o';
    return 'gpt-4o-mini';
  }

  private buildBody(request: GenerationRequest, stream: boolean) {
    return {
      model: this.resolveModel(request),
      messages: request.messages,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 2048,
      stream,
    };
  }

  private headers(apiKey: string) {
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async generate(request: GenerationRequest, apiKey?: string): Promise<GenerationResponse> {
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
    const started = Date.now();
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(apiKey),
      body: JSON.stringify(this.buildBody(request, false)),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      throw new Error(`OpenAI returned ${response.status}: ${(await response.text()).slice(0, 500)}`);
    }
    const body = await response.json() as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };
    const content = body.choices?.[0]?.message?.content ?? '';
    const usage: TokenUsage = {
      promptTokens: body.usage?.prompt_tokens ?? 0,
      completionTokens: body.usage?.completion_tokens ?? 0,
      totalTokens: (body.usage?.prompt_tokens ?? 0) + (body.usage?.completion_tokens ?? 0),
    };
    return {
      content,
      provider: this.id,
      model: body.model ?? this.resolveModel(request),
      usage,
      latencyMs: Date.now() - started,
      finishReason: body.choices?.[0]?.finish_reason,
      raw: body,
    };
  }

  async *stream(request: GenerationRequest, apiKey?: string): AsyncGenerator<StreamChunk> {
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
    const model = this.resolveModel(request);
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(apiKey),
      body: JSON.stringify(this.buildBody(request, true)),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`OpenAI stream returned ${response.status}`);

    for await (const event of parseSSE(response)) {
      const payload = safeJson<{
        choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      }>(event.data);
      if (!payload) continue;
      const delta = payload.choices?.[0]?.delta?.content ?? '';
      const usage = payload.usage
        ? {
            promptTokens: payload.usage.prompt_tokens ?? 0,
            completionTokens: payload.usage.completion_tokens ?? 0,
            totalTokens: (payload.usage.prompt_tokens ?? 0) + (payload.usage.completion_tokens ?? 0),
          }
        : undefined;
      if (delta || payload.choices?.[0]?.finish_reason || payload.usage) {
        yield { delta, provider: this.id, model, done: Boolean(payload.choices?.[0]?.finish_reason), usage };
      }
    }
    yield { delta: '', provider: this.id, model, done: true };
  }
}
