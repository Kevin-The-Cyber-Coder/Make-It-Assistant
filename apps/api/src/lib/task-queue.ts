import type { RedisClient } from './redis';

export interface QueueTask {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface TaskQueue {
  enqueue(task: QueueTask): Promise<void>;
  dequeue(): Promise<QueueTask | null>;
  length(): Promise<number>;
  readonly mode: 'redis' | 'memory';
}

export function createTaskQueue(redis: RedisClient | null, name = 'mia:tasks'): TaskQueue {
  if (redis) {
    return {
      mode: 'redis',
      async enqueue(task) {
        await redis.lpush(name, JSON.stringify(task));
      },
      async dequeue() {
        const raw = await redis.rpop(name);
        return raw ? JSON.parse(raw) as QueueTask : null;
      },
      async length() {
        return redis.llen(name);
      },
    };
  }

  const tasks: QueueTask[] = [];
  return {
    mode: 'memory',
    async enqueue(task) {
      tasks.push(task);
    },
    async dequeue() {
      return tasks.shift() ?? null;
    },
    async length() {
      return tasks.length;
    },
  };
}
