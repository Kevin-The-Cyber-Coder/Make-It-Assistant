import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { AppError, toAppError } from '@make-it-ai/shared';
import type { AppContext } from '../context';
import { verifyToken } from '../lib/crypto';
import type { Logger } from '../lib/logger';

export function requestId(request: Request, response: Response, next: NextFunction): void {
  request.requestId = randomUUID();
  response.setHeader('X-Request-Id', request.requestId);
  next();
}

export function securityHeaders(request: Request, response: Response, next: NextFunction): void {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-XSS-Protection', '0');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
}

export function rateLimit(windowMs: number, max: number): RequestHandler {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (request, response, next) => {
    const key = request.ip ?? 'unknown';
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    bucket.count += 1;
    response.setHeader('X-RateLimit-Limit', String(max));
    response.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    if (bucket.count > max) return next(new AppError('RATE_LIMITED', 'Too many requests'));
    return next();
  };
}

/**
 * Rate limiter backed by the shared context. Uses Redis when REDIS_URL is
 * reachable and an in-process store otherwise. Failures fail open and are
 * logged, so a Redis outage never takes the API down.
 */
export function distributedRateLimit(context: AppContext): RequestHandler {
  return async (request, response, next) => {
    const key = `${request.ip ?? 'unknown'}:${request.path}`;
    try {
      const result = await context.rateLimiter.check(key);
      response.setHeader('X-RateLimit-Limit', String(context.env.RATE_LIMIT_MAX));
      response.setHeader('X-RateLimit-Remaining', String(result.remaining));
      response.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1_000)));
      response.setHeader('X-RateLimit-Store', result.store);
      if (!result.allowed) return next(new AppError('RATE_LIMITED', 'Too many requests'));
      return next();
    } catch (error) {
      context.logger.warn('Rate limiter unavailable; allowing request', {
        message: error instanceof Error ? error.message : String(error),
      });
      return next();
    }
  };
}

export function requireAuth(context: AppContext): RequestHandler {
  return async (request, _response, next) => {
    try {
      const header = request.headers.authorization;
      if (!header?.startsWith('Bearer ')) throw new AppError('UNAUTHORIZED', 'Bearer token required');
      const payload = verifyToken(header.slice(7), context.env.JWT_SECRET);
      if (!payload || payload.type !== 'access') throw new AppError('UNAUTHORIZED', 'Invalid or expired access token');
      const user = await context.db.repositories.users.findById(payload.sub);
      if (!user) throw new AppError('UNAUTHORIZED', 'User no longer exists');
      const roles = Object.entries(user.organizationRoles) as Array<[string, typeof user.organizationRoles[string]]>;
      const requested = request.header('x-organization-id');
      const entry = requested
        ? roles.find(([organizationId]) => organizationId === requested)
        : roles[0];
      if (!entry) throw new AppError('FORBIDDEN', 'No accessible organization');
      request.actor = {
        userId: user.id,
        email: user.email,
        organizationId: entry[0],
        roles: [entry[1]],
      };
      next();
    } catch (error) {
      next(toAppError(error));
    }
  };
}

export function requireRole(...allowed: Array<'owner' | 'admin' | 'developer'>): RequestHandler {
  return (request, _response, next) => {
    if (!request.actor) return next(new AppError('UNAUTHORIZED', 'Authentication required'));
    const hasRole = request.actor.roles.some((role) => allowed.includes(role as 'owner' | 'admin' | 'developer'));
    return hasRole ? next() : next(new AppError('FORBIDDEN', 'Insufficient role'));
  };
}

export function validate(schema: ZodTypeAny): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      return next(new AppError('VALIDATION_ERROR', 'Request validation failed', result.error.flatten()));
    }
    request.body = result.data;
    return next();
  };
}

export function notFound(request: Request, _response: Response, next: NextFunction): void {
  next(new AppError('NOT_FOUND', `Route not found: ${request.method} ${request.path}`));
}

export function errorHandler(logger: Logger): (error: unknown, request: Request, response: Response, _next: NextFunction) => void {
  return (error, request, response, _next) => {
    const appError = toAppError(error);
    if (appError.status >= 500) logger.error(appError.message, { requestId: request.requestId, path: request.path });
    else logger.debug(appError.message, { requestId: request.requestId, path: request.path });
    response.status(appError.status).json({
      error: {
        code: appError.code,
        message: appError.message,
        details: appError.details,
        requestId: request.requestId,
      },
    });
  };
}
