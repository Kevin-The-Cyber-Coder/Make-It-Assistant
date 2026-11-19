import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type {
  SandboxExecuteRequest,
  SandboxStageRequest,
} from '@make-it-ai/shared';
import type { WorkerConfig } from './config';
import { executeInSandbox, stageArtifacts } from './executor';

export function createWorkerApp(config: WorkerConfig): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '8mb' }));

  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.path === '/healthz') return next();
    if (config.token && request.header('x-sandbox-token') !== config.token) {
      return response.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid sandbox token' } });
    }
    return next();
  });

  app.get('/healthz', (_request, response) => {
    response.json({
      status: 'ok',
      service: 'make-it-ai-sandbox-worker',
      allowedCommands: config.allowedCommands,
      approvalRequired: true,
    });
  });

  app.post('/execute', async (request, response, next) => {
    try {
      const result = await executeInSandbox(request.body as SandboxExecuteRequest, config);
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/stage', async (request, response, next) => {
    try {
      const result = await stageArtifacts(request.body as SandboxStageRequest, config);
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : String(error);
    response.status(400).json({ error: { code: 'SANDBOX_REJECTED', message } });
  });

  return app;
}
