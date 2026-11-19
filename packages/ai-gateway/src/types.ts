import type { ChatMessage, TaskType } from '@make-it-ai/shared';

export type { ChatMessage, TaskType } from '@make-it-ai/shared';

export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'local-rules';

export type Capability =
  | 'coding'
  | 'reasoning'
  | 'vision'
  | 'tool-calling'
  | 'long-context'
  | 'documentation'
  | 'security';

export interface ModelInfo {
  id: string;
  provider: ProviderId;
  displayName: string;
  capabilities: Capability[];
  contextWindow: number;
  costPer1kInput?: number;
  costPer1kOutput?: number;
}

export interface GenerationRequest {
  messages: ChatMessage[];
  taskType?: TaskType;
  provider?: ProviderId;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GenerationResponse {
  content: string;
  provider: ProviderId;
  model: string;
  usage: TokenUsage;
  latencyMs: number;
  finishReason?: string;
  raw?: unknown;
}

export interface StreamChunk {
  delta: string;
  provider: ProviderId;
  model: string;
  done: boolean;
  usage?: TokenUsage;
}

export interface ProviderAdapter {
  readonly id: ProviderId;
  listModels(): ModelInfo[];
  generate(request: GenerationRequest, apiKey?: string): Promise<GenerationResponse>;
  stream(request: GenerationRequest, apiKey?: string): AsyncIterable<StreamChunk>;
  healthCheck?(apiKey?: string): Promise<boolean>;
}

export interface UsageRecord {
  provider: ProviderId;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  success: boolean;
  organizationId?: string;
  userId?: string;
}

export interface GatewayConfig {
  apiKeys: Partial<Record<ProviderId, string>>;
  baseUrls?: Partial<Record<ProviderId, string>>;
  fallbackOrder: ProviderId[];
  maxContextTokens: number;
  defaultMaxTokens: number;
  enableLocalFallback: boolean;
  onUsage?: (record: UsageRecord) => void;
  onEvent?: (event: { type: string; message: string; metadata?: Record<string, unknown> }) => void;
}

export interface Candidate {
  provider: ProviderId;
  model: string;
  score: number;
  reason: string;
}
