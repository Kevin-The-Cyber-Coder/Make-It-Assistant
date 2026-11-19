import { AIGateway, type ProviderId } from '@make-it-ai/ai-gateway';
import { Orchestrator, type ExecutionResult } from '@make-it-ai/agents';
import type { DatabaseHandle } from '@make-it-ai/database';
import type { ProjectFile, SandboxExecuteResult, TaskType } from '@make-it-ai/shared';
import type { Env } from './config/env';
import type { AppContext } from './context';
import { EventBus } from './lib/event-bus';
import { Logger } from './lib/logger';
import { connectRedis } from './lib/redis';
import { createRateLimiter } from './lib/rate-limit';
import { createTaskQueue } from './lib/task-queue';

function parseFallbackOrder(value: string): ProviderId[] {
  const allowed: ProviderId[] = ['openai', 'anthropic', 'gemini', 'local-rules'];
  const parsed = value.split(',').map((part) => part.trim() as ProviderId).filter((id) => allowed.includes(id));
  return parsed.length ? parsed : ['local-rules'];
}

export async function buildContext(env: Env, db: DatabaseHandle): Promise<AppContext> {
  const logger = new Logger(env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error');
  const bus = new EventBus();
  const redis = await connectRedis(env.REDIS_URL, logger);
  const rateLimiter = createRateLimiter(redis, env.RATE_LIMIT_WINDOW_MS, env.RATE_LIMIT_MAX);
  const queue = createTaskQueue(redis);

  const gateway = new AIGateway({
    apiKeys: {
      openai: env.OPENAI_API_KEY || undefined,
      anthropic: env.ANTHROPIC_API_KEY || undefined,
      gemini: env.GEMINI_API_KEY || undefined,
    },
    baseUrls: {
      openai: env.OPENAI_BASE_URL,
      anthropic: env.ANTHROPIC_BASE_URL,
      gemini: env.GEMINI_BASE_URL,
    },
    fallbackOrder: parseFallbackOrder(env.AI_FALLBACK_ORDER),
    maxContextTokens: 32_000,
    defaultMaxTokens: 2048,
    enableLocalFallback: true,
    onUsage: (record) => {
      if (!record.organizationId) return;
      void db.repositories.modelUsage.create({
        id: `usage_${crypto.randomUUID()}`,
        organizationId: record.organizationId,
        userId: record.userId ?? 'unknown',
        provider: record.provider,
        model: record.model,
        promptTokens: record.promptTokens,
        completionTokens: record.completionTokens,
        latencyMs: record.latencyMs,
        success: record.success,
        createdAt: new Date().toISOString(),
      });
    },
    onStreamUsage: (summary) => {
      if (!summary.organizationId) return;
      void db.repositories.modelUsage.create({
        id: `usage_${crypto.randomUUID()}`,
        organizationId: summary.organizationId,
        userId: summary.userId ?? 'unknown',
        provider: summary.provider,
        model: summary.model,
        promptTokens: summary.promptTokens,
        completionTokens: summary.completionTokens,
        latencyMs: summary.durationMs,
        success: summary.success,
        createdAt: new Date().toISOString(),
      });
      bus.publish({
        type: 'ai:stream-usage',
        message: summary.estimated ? 'Stream token usage estimated' : 'Stream token usage reported by provider',
        organizationId: summary.organizationId,
        payload: {
          provider: summary.provider,
          model: summary.model,
          totalTokens: summary.totalTokens,
          firstTokenMs: summary.firstTokenMs,
          durationMs: summary.durationMs,
          estimated: summary.estimated,
        },
      });
    },
    onEvent: (event) => bus.publish({
      type: event.type,
      message: event.message,
      payload: event.metadata,
    }),
  });

  const chat = async (
    prompt: string,
    taskType: TaskType,
    files: ProjectFile[],
    metadata?: Record<string, unknown>,
  ): Promise<string> => {
    const result = await gateway.chat({
      messages: [{ role: 'user', content: prompt }],
      taskType,
      context: files.slice(0, 20),
      metadata,
    });
    return result.content;
  };

  const sandboxExecutor: ((command: string, files?: ProjectFile[]) => Promise<ExecutionResult>) | undefined = env.SANDBOX_URL
    ? async (command, files = []) => {
        const baseUrl = env.SANDBOX_URL.replace(/\/$/, '');
        const response = await fetch(`${baseUrl}/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Sandbox-Token': env.SANDBOX_TOKEN,
          },
          body: JSON.stringify({
            command,
            files,
            approved: true,
            timeoutMs: env.SANDBOX_TIMEOUT_MS,
          }),
          signal: AbortSignal.timeout(env.SANDBOX_TIMEOUT_MS + 5_000),
        });
        if (!response.ok) {
          const detail = (await response.text()).slice(0, 300);
          throw new Error(`Sandbox execution failed with ${response.status}: ${detail}`);
        }
        const result = await response.json() as SandboxExecuteResult;
        return { exitCode: result.exitCode, output: result.output, durationMs: result.durationMs };
      }
    : undefined;

  const indexes = new Map<string, import('@make-it-ai/shared').ProjectIndex>();
  const orchestrator = new Orchestrator({
    repositories: db.repositories,
    chat,
    filesForProject: async (projectId) => (projectId ? indexes.get(projectId)?.files ?? [] : []),
    executor: sandboxExecutor,
  });

  return { env, db, gateway, orchestrator, bus, logger, indexes, redis, rateLimiter, queue };
}
