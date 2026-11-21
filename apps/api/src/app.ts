import express, { Router } from 'express';
import cors from 'cors';
import type { Express } from 'express';
import type { AppContext } from './context';
import { distributedRateLimit, errorHandler, notFound, requestId, securityHeaders } from './middleware';
import { createAuthRouter } from './modules/auth/routes';
import { createProjectRouter } from './modules/projects/routes';
import { createConversationRouter } from './modules/conversations/routes';
import { createAIRouter } from './modules/ai/routes';
import { createAgentRouter } from './modules/agents/routes';
import { createSecurityRouter } from './modules/security/routes';
import { createDevRouter } from './modules/dev/routes';
import { createGithubRouter } from './modules/github/routes';
import { createGithubOAuthRouter } from './modules/github/oauth';
import { createAnalyticsRouter } from './modules/analytics/routes';
import { createAuditRouter } from './modules/audit/routes';
import { createSearchRouter } from './modules/search/routes';
import { createSystemRouter } from './modules/system/routes';

export function createApp(context: AppContext): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));
  app.use(requestId);
  app.use(securityHeaders);
  app.use(cors({
    origin: context.env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim()),
    credentials: true,
    exposedHeaders: ['X-Request-Id'],
  }));
  app.use(distributedRateLimit(context));

  app.get('/healthz', (_request, response) => {
    response.json({
      status: 'ok',
      service: 'make-it-ai-api',
      storage: context.db.mode,
      redis: context.redis ? 'connected' : 'disabled',
      rateLimitStore: context.rateLimiter.mode,
      queueStore: context.queue.mode,
      providers: context.gateway.listProviders().filter((provider) => provider.configured).map((provider) => provider.id),
      timestamp: new Date().toISOString(),
    });
  });

  const api = Router();
  api.use('/auth', createAuthRouter(context));
  api.use('/projects', createProjectRouter(context));
  api.use('/conversations', createConversationRouter(context));
  api.use('/ai', createAIRouter(context));
  api.use('/agents', createAgentRouter(context));
  api.use('/security', createSecurityRouter(context));
  api.use('/dev', createDevRouter(context));
  // Mounted first so the public OAuth callback is reachable without a bearer token.
  api.use('/github/oauth', createGithubOAuthRouter(context));
  api.use('/github', createGithubRouter(context));
  api.use('/analytics', createAnalyticsRouter(context));
  api.use('/audit', createAuditRouter(context));
  api.use('/search', createSearchRouter(context));
  api.use('/system', createSystemRouter(context));
  app.use(context.env.API_PREFIX, api);

  app.use(notFound);
  app.use(errorHandler(context.logger));
  return app;
}
