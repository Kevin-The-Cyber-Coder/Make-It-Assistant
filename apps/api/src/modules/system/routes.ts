import { Router, type Request, type RequestHandler, type Response } from 'express';
import os from 'node:os';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AppContext } from '../../context';
import { requireAuth } from '../../middleware';

const startedAt = new Date().toISOString();
let cachedVersion: string | null = null;

async function readVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const raw = await readFile(pkgPath, 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    cachedVersion = typeof parsed.version === 'string' ? parsed.version : '0.0.0';
  } catch {
    cachedVersion = '0.0.0';
  }
  return cachedVersion;
}

function asyncRoute(handler: (request: Request, response: Response) => Promise<void>): RequestHandler {
  return (request, response, next) => {
    handler(request, response).catch(next);
  };
}

export function createSystemRouter(context: AppContext): Router {
  const router = Router();
  router.use(requireAuth(context));

  router.get('/version', asyncRoute(async (_request, response) => {
    response.json({
      name: 'make-it-ai',
      service: 'make-it-ai-api',
      version: await readVersion(),
      nodeVersion: process.version,
      platform: process.platform,
      startedAt,
      timestamp: new Date().toISOString(),
      commit: process.env.GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    });
  }));

  router.get('/status', asyncRoute(async (_request, response) => {
    const repositories = context.db.repositories;
    const [
      organizations,
      users,
      projects,
      conversations,
      agentTasks,
      securityScans,
      codeReviews,
      testRuns,
      auditLogs,
      modelUsage,
    ] = await Promise.all([
      repositories.organizations.count(),
      repositories.users.count(),
      repositories.projects.count(),
      repositories.conversations.count(),
      repositories.agentTasks.count(),
      repositories.securityScans.count(),
      repositories.codeReviews.count(),
      repositories.testRuns.count(),
      repositories.auditLogs.count(),
      repositories.modelUsage.count(),
    ]);

    response.json({
      status: 'ok',
      service: 'make-it-ai-api',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
      hostname: os.hostname(),
      storage: {
        mode: context.db.mode,
      },
      redis: {
        configured: Boolean(context.env.REDIS_URL),
        connected: Boolean(context.redis),
      },
      rateLimit: {
        mode: context.rateLimiter.mode,
        windowMs: context.env.RATE_LIMIT_WINDOW_MS,
        max: context.env.RATE_LIMIT_MAX,
      },
      queue: {
        mode: context.queue.mode,
      },
      providers: context.gateway.listProviders().map((provider) => ({
        id: provider.id,
        configured: provider.configured,
        models: provider.models.length,
      })),
      counts: {
        organizations,
        users,
        projects,
        conversations,
        agentTasks,
        securityScans,
        codeReviews,
        testRuns,
        auditLogs,
        modelUsage,
      },
    });
  }));

  return router;
}
