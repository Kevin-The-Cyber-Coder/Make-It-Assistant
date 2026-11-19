import type { AIGateway } from '@make-it-ai/ai-gateway';
import type { Orchestrator } from '@make-it-ai/agents';
import type { DatabaseHandle } from '@make-it-ai/database';
import type { ProjectIndex, Role } from '@make-it-ai/shared';
import type { Env } from './config/env';
import type { EventBus } from './lib/event-bus';
import type { Logger } from './lib/logger';
import type { RedisClient } from './lib/redis';
import type { RateLimiter } from './lib/rate-limit';
import type { TaskQueue } from './lib/task-queue';

export interface Actor {
  userId: string;
  email: string;
  organizationId: string;
  roles: Role[];
}

export interface AppContext {
  env: Env;
  db: DatabaseHandle;
  gateway: AIGateway;
  orchestrator: Orchestrator;
  bus: EventBus;
  logger: Logger;
  indexes: Map<string, ProjectIndex>;
  redis: RedisClient | null;
  rateLimiter: RateLimiter;
  queue: TaskQueue;
}
