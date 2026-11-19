import Redis from 'ioredis';
import type { Logger } from './logger';

export type RedisClient = Redis;

export async function connectRedis(url: string, logger: Logger): Promise<RedisClient | null> {
  if (!url) return null;
  const client = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (attempt) => (attempt < 3 ? Math.min(attempt * 200, 1_000) : null),
  });
  client.on('error', (error) => logger.warn('Redis client error', { message: error.message }));
  try {
    await client.connect();
    logger.info('Redis connected');
    return client;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Redis unavailable; falling back to in-memory stores', { message });
    client.disconnect();
    return null;
  }
}
