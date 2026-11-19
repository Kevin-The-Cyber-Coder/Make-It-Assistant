import type { ProjectFile } from '@make-it-ai/shared';
import { CapabilityRegistry } from './capability-registry';
import { ContextManager } from './context-manager';
import { EvaluationEngine, type EvaluationResult } from './evaluation-engine';
import { FallbackManager } from './fallback-manager';
import { ModelRouter } from './model-router';
import { PromptManager } from './prompt-manager';
import { createDefaultRegistry, ProviderRegistry } from './provider-registry';
import { normalizeResponse, type NormalizedResponse } from './response-normalizer';
import { managedStream } from './stream-manager';
import { TokenManager } from './token-manager';
import type {
  Candidate,
  GatewayConfig,
  GenerationRequest,
  GenerationResponse,
  StreamChunk,
} from './types';

export interface GatewayRequest extends GenerationRequest {
  context?: ProjectFile[];
}

export type GatewayResponse = GenerationResponse & {
  candidate: Candidate;
  evaluation: EvaluationResult;
  normalized: NormalizedResponse;
};

const DEFAULTS: GatewayConfig = {
  apiKeys: {},
  fallbackOrder: ['openai', 'anthropic', 'gemini', 'local-rules'],
  maxContextTokens: 32_000,
  defaultMaxTokens: 2048,
  enableLocalFallback: true,
};

export class AIGateway {
  readonly config: GatewayConfig;
  readonly providers: ProviderRegistry;
  readonly capabilities = new CapabilityRegistry();
  readonly tokenManager: TokenManager;
  readonly contextManager: ContextManager;
  readonly promptManager = new PromptManager();
  readonly router: ModelRouter;
  readonly fallback: FallbackManager;
  readonly evaluation = new EvaluationEngine();

  constructor(config: Partial<GatewayConfig> = {}, providers?: ProviderRegistry) {
    this.config = {
      ...DEFAULTS,
      ...config,
      apiKeys: { ...DEFAULTS.apiKeys, ...config.apiKeys },
      baseUrls: { ...config.baseUrls },
    };
    this.providers = providers ?? createDefaultRegistry(this.config);
    this.tokenManager = new TokenManager(this.config.maxContextTokens);
    this.contextManager = new ContextManager(this.tokenManager);
    this.router = new ModelRouter(this.providers, this.capabilities, this.config);
    this.fallback = new FallbackManager(this.providers, this.config);
  }

  listProviders() {
    return this.providers.all().map((adapter) => ({
      id: adapter.id,
      models: adapter.listModels(),
      configured: this.providers.hasCredentials(adapter.id, this.config),
    }));
  }

  listModels() {
    return this.providers.listModels();
  }

  private prepare(request: GatewayRequest): GenerationRequest {
    const messages = this.promptManager.build(request.messages, request.taskType ?? 'general');
    const context = this.contextManager.retrieve(
      [...messages].reverse().find((message) => message.role === 'user')?.content ?? '',
      request.context ?? [],
    );
    const withContext = this.contextManager.attach(messages, this.contextManager.formatForPrompt(context));
    return {
      ...request,
      messages: this.tokenManager.fitMessages(withContext, this.tokenManager.clamp(request.maxTokens, this.config.defaultMaxTokens)),
      maxTokens: this.tokenManager.clamp(request.maxTokens, this.config.defaultMaxTokens),
    };
  }

  async chat(request: GatewayRequest): Promise<GatewayResponse> {
    const prepared = this.prepare(request);
    const result = await this.fallback.execute(this.router.candidates(prepared), async (candidate, apiKey) => {
      const adapter = this.providers.get(candidate.provider);
      if (!adapter) throw new Error(`Unknown provider ${candidate.provider}`);
      return adapter.generate({ ...prepared, provider: candidate.provider, model: candidate.model }, apiKey);
    });

    const normalized = normalizeResponse(result.value.content);
    const evaluation = this.evaluation.evaluate(result.value, prepared);
    this.config.onUsage?.({
      provider: result.value.provider,
      model: result.value.model,
      promptTokens: result.value.usage.promptTokens,
      completionTokens: result.value.usage.completionTokens,
      latencyMs: result.value.latencyMs,
      success: evaluation.passed,
      organizationId: typeof prepared.metadata?.organizationId === 'string' ? prepared.metadata.organizationId : undefined,
      userId: typeof prepared.metadata?.userId === 'string' ? prepared.metadata.userId : undefined,
    });
    return { ...result.value, candidate: result.candidate, evaluation, normalized };
  }

  async *stream(request: GatewayRequest): AsyncGenerator<StreamChunk> {
    const prepared = this.prepare(request);
    yield* managedStream(prepared, {
      config: this.config,
      providers: this.providers,
      candidates: (req) => this.router.candidates(req),
    });
  }
}
