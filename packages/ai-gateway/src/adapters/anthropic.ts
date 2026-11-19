import { CapabilityRegistry } from '../capability-registry';
import type { ChatMessage, GenerationRequest, GenerationResponse, ProviderAdapter, StreamChunk } from '../types';
import { parseSSE, safeJson } from './sse';

const capabilities = new CapabilityRegistry();

function splitSystem(messages: ChatMessage[]): { system: string; turns: Array<{ role: 'user' | 'assistant'; content: string }> } {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const turns = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  if (turns[0]?.role !== 'user') turns.unshift({ role: 'user', content: 'Please continue.' });
  return { system, turns };
}

export class AnthropicAdapter implements ProviderAdapter {
  readonly id = 'anthropic' as const;
  private readonly baseUrl: string;

  constructor(baseUrl = 'https://api.anthropic.com/v1') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  listModels() {
    return capabilities.list('anthropic');
  }

  private headers(apiKey: string) {
    return {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    };
  }

  private resolveModel(request: GenerationRequest): string {
    if (request.model) return request.model;
    return request.taskType === 'generate' || request.taskType === 'security'
      ? 'claude-3-5-sonnet-latest'
      : 'claude-3-5-haiku-latest';
  }

  private body(request: GenerationRequest, stream: boolean) {
    const { system, turns } = splitSystem(request.messages);
    return {
      model: this.resolveModel(request),
      max_tokens: request.maxTokens ?? 2048,
      temperature: request.temperature ?? 0.2,
      ...(system ? { system } : {}),
      messages: turns,
      stream,
    };
  }

  async generate(request: GenerationRequest, apiKey?: string): Promise<GenerationResponse> {
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');
    const started = Date.now();
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: this.headers(apiKey),
      body: JSON.stringify(this.body(request, false)),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`Anthropic returned ${response.status}: ${(await response.text()).slice(0, 500)}`);
    const body = await response.json() as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      model?: string;
      stop_reason?: string;
    };
    const content = (body.content ?? []).filter((block) => block.type === 'text').map((block) => block.text ?? '').join('');
    const promptTokens = body.usage?.input_tokens ?? 0;
    const completionTokens = body.usage?.output_tokens ?? 0;
    return {
      content,
      provider: this.id,
      model: body.model ?? this.resolveModel(request),
      usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
      latencyMs: Date.now() - started,
      finishReason: body.stop_reason,
      raw: body,
    };
  }

  async *stream(request: GenerationRequest, apiKey?: string): AsyncGenerator<StreamChunk> {
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');
    const model = this.resolveModel(request);
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: this.headers(apiKey),
      body: JSON.stringify(this.body(request, true)),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`Anthropic stream returned ${response.status}`);

    for await (const event of parseSSE(response)) {
      if (event.data === '[DONE]') break;
      const payload = safeJson<{
        type?: string;
        delta?: { type?: string; text?: string };
        message?: { usage?: { input_tokens?: number; output_tokens?: number } };
        usage?: { output_tokens?: number };
      }>(event.data);
      if (!payload) continue;
      if (payload.type === 'content_block_delta' && payload.delta?.type === 'text_delta') {
        yield { delta: payload.delta.text ?? '', provider: this.id, model, done: false };
      }
      if (payload.type === 'message_delta') {
        yield {
          delta: '',
          provider: this.id,
          model,
          done: true,
          usage: {
            promptTokens: payload.message?.usage?.input_tokens ?? 0,
            completionTokens: payload.usage?.output_tokens ?? 0,
            totalTokens: (payload.message?.usage?.input_tokens ?? 0) + (payload.usage?.output_tokens ?? 0),
          },
        };
      }
    }
    yield { delta: '', provider: this.id, model, done: true };
  }
}
