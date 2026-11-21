import { Router, type Request, type RequestHandler, type Response } from 'express';
import os from 'node:os';
import type { AppContext } from '../../context';
import { requireAuth } from '../../middleware';

function asyncRoute(handler: (request: Request, response: Response) => Promise<void>): RequestHandler {
  return (request, response, next) => {
    handler(request, response).catch(next);
  };
}

export function createSystemRouter(context: AppContext): Router {
  const router = Router();
  router.use(requireAuth(context));

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
