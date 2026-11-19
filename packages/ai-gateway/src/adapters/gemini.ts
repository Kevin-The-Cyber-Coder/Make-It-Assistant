import { CapabilityRegistry } from '../capability-registry';
import type { ChatMessage, GenerationRequest, GenerationResponse, ProviderAdapter, StreamChunk } from '../types';
import { parseSSE, safeJson } from './sse';

const capabilities = new CapabilityRegistry();

function buildContents(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));
}

function buildSystem(messages: ChatMessage[]) {
  return messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
}

export class GeminiAdapter implements ProviderAdapter {
  readonly id = 'gemini' as const;
  private readonly baseUrl: string;

  constructor(baseUrl = 'https://generativelanguage.googleapis.com/v1beta') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  listModels() {
    return capabilities.list('gemini');
  }

  private resolveModel(request: GenerationRequest): string {
    return request.model ?? (request.taskType === 'architecture' ? 'gemini-1.5-pro' : 'gemini-2.0-flash');
  }

  private body(request: GenerationRequest) {
    const system = buildSystem(request.messages);
    return {
      contents: buildContents(request.messages),
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: {
        temperature: request.temperature ?? 0.2,
        maxOutputTokens: request.maxTokens ?? 2048,
      },
    };
  }

  private url(request: GenerationRequest, apiKey: string, stream: boolean): string {
    const action = stream ? 'streamGenerateContent' : 'generateContent';
    const suffix = stream ? '&alt=sse' : '';
    return `${this.baseUrl}/models/${this.resolveModel(request)}:${action}?key=${encodeURIComponent(apiKey)}${suffix}`;
  }

  async generate(request: GenerationRequest, apiKey?: string): Promise<GenerationResponse> {
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    const started = Date.now();
    const response = await fetch(this.url(request, apiKey, false), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.body(request)),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`Gemini returned ${response.status}: ${(await response.text()).slice(0, 500)}`);
    const body = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const content = (body.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? '').join('');
    const promptTokens = body.usageMetadata?.promptTokenCount ?? 0;
    const completionTokens = body.usageMetadata?.candidatesTokenCount ?? 0;
    return {
      content,
      provider: this.id,
      model: this.resolveModel(request),
      usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
      latencyMs: Date.now() - started,
      finishReason: body.candidates?.[0]?.finishReason,
      raw: body,
    };
  }

  async *stream(request: GenerationRequest, apiKey?: string): AsyncGenerator<StreamChunk> {
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    const model = this.resolveModel(request);
    const response = await fetch(this.url(request, apiKey, true), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.body(request)),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`Gemini stream returned ${response.status}`);

    for await (const event of parseSSE(response)) {
      const payload = safeJson<{
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      }>(event.data);
      if (!payload) continue;
      const delta = (payload.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? '').join('');
      const done = Boolean(payload.candidates?.[0]?.finishReason);
      yield { delta, provider: this.id, model, done };
    }
    yield { delta: '', provider: this.id, model, done: true };
  }
}
