import type { RedisClient } from './redis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  store: 'redis' | 'memory';
}

export interface RateLimiter {
  check(key: string): Promise<RateLimitResult>;
  readonly mode: 'redis' | 'memory';
}

export function createRateLimiter(
  redis: RedisClient | null,
  windowMs: number,
  max: number,
): RateLimiter {
  if (redis) {
    return {
      mode: 'redis',
      async check(key) {
        const redisKey = `mia:ratelimit:${key}`;
        const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1_000));
        const result = await redis.multi().incr(redisKey).expire(redisKey, ttlSeconds, 'NX').exec();
        const count = Number(result?.[0]?.[1] ?? 1);
        const ttl = Number(result?.[1]?.[1] ?? ttlSeconds);
        return {
          allowed: count <= max,
          remaining: Math.max(0, max - count),
          resetAt: Date.now() + Math.max(0, ttl) * 1_000,
          store: 'redis',
        };
      },
    };
  }

  const buckets = new Map<string, { count: number; resetAt: number }>();
  return {
    mode: 'memory',
    async check(key) {
      const now = Date.now();
      const bucket = buckets.get(key);
      if (!bucket || now > bucket.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: max - 1, resetAt: now + windowMs, store: 'memory' };
      }
      bucket.count += 1;
      return {
        allowed: bucket.count <= max,
        remaining: Math.max(0, max - bucket.count),
        resetAt: bucket.resetAt,
        store: 'memory',
      };
    },
  };
}
