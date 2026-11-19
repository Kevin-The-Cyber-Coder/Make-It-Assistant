import type { Capability, ModelInfo, ProviderId, TaskType } from './types';

const CATALOG: ModelInfo[] = [
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    displayName: 'OpenAI GPT-4o mini',
    capabilities: ['coding', 'reasoning', 'tool-calling', 'documentation', 'vision'],
    contextWindow: 128_000,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    displayName: 'OpenAI GPT-4o',
    capabilities: ['coding', 'reasoning', 'tool-calling', 'vision', 'long-context', 'documentation'],
    contextWindow: 128_000,
    costPer1kInput: 0.0025,
    costPer1kOutput: 0.01,
  },
  {
    id: 'claude-3-5-sonnet-latest',
    provider: 'anthropic',
    displayName: 'Anthropic Claude 3.5 Sonnet',
    capabilities: ['coding', 'reasoning', 'tool-calling', 'long-context', 'documentation', 'security', 'vision'],
    contextWindow: 200_000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
  },
  {
    id: 'claude-3-5-haiku-latest',
    provider: 'anthropic',
    displayName: 'Anthropic Claude 3.5 Haiku',
    capabilities: ['coding', 'documentation', 'tool-calling'],
    contextWindow: 200_000,
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
  },
  {
    id: 'gemini-2.0-flash',
    provider: 'gemini',
    displayName: 'Google Gemini 2.0 Flash',
    capabilities: ['coding', 'vision', 'long-context', 'documentation', 'tool-calling'],
    contextWindow: 1_000_000,
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0004,
  },
  {
    id: 'gemini-1.5-pro',
    provider: 'gemini',
    displayName: 'Google Gemini 1.5 Pro',
    capabilities: ['coding', 'reasoning', 'vision', 'long-context', 'documentation'],
    contextWindow: 2_000_000,
    costPer1kInput: 0.00125,
    costPer1kOutput: 0.005,
  },
  {
    id: 'rule-engine-v1',
    provider: 'local-rules',
    displayName: 'Local rule engine (offline, deterministic)',
    capabilities: ['coding', 'security', 'documentation', 'reasoning'],
    contextWindow: 32_000,
  },
];

const TASK_CAPABILITIES: Record<TaskType, Capability[]> = {
  general: ['reasoning'],
  explain: ['coding', 'reasoning'],
  generate: ['coding', 'tool-calling'],
  security: ['security', 'coding'],
  debug: ['reasoning', 'coding'],
  documentation: ['documentation'],
  architecture: ['reasoning', 'long-context'],
};

export class CapabilityRegistry {
  list(provider?: ProviderId): ModelInfo[] {
    return CATALOG.filter((model) => !provider || model.provider === provider).map((model) => ({ ...model }));
  }

  find(modelId: string): ModelInfo | undefined {
    const found = CATALOG.find((model) => model.id === modelId);
    return found ? { ...found } : undefined;
  }

  requiredCapabilities(taskType: TaskType): Capability[] {
    return TASK_CAPABILITIES[taskType] ?? TASK_CAPABILITIES.general;
  }

  score(model: ModelInfo, taskType: TaskType): number {
    const required = this.requiredCapabilities(taskType);
    const matched = required.filter((capability) => model.capabilities.includes(capability)).length;
    const base = required.length === 0 ? 1 : matched / required.length;
    const longContextBonus = required.includes('long-context') && model.capabilities.includes('long-context') ? 0.1 : 0;
    const costPenalty = Math.min(0.15, (model.costPer1kOutput ?? 0) * 5);
    return Math.max(0, base + longContextBonus - costPenalty);
  }

  hasCapabilities(model: ModelInfo, capabilities: Capability[]): boolean {
    return capabilities.every((capability) => model.capabilities.includes(capability));
  }
}
