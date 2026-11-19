import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { verifyToken } from './lib/crypto';
import { connectDatabase } from '@make-it-ai/database';
import { buildContext } from './bootstrap';
import { loadEnv } from './config/env';
import { createApp } from './app';

async function main(): Promise<void> {
  const env = loadEnv();
  const db = await connectDatabase({
    mongoUri: env.MONGODB_URI || undefined,
    mongoDb: env.MONGODB_DB,
    dataDir: env.MONGODB_URI ? undefined : env.DATA_DIR,
  });
  const context = await buildContext(env, db);
  const app = createApp(context);
  const server = createServer(app);
  const websocket = new WebSocketServer({ server, path: '/ws' });

  websocket.on('connection', async (socket, request) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const token = url.searchParams.get('token');
    const payload = token ? verifyToken(token, context.env.JWT_SECRET) : null;
    const user = payload?.type === 'access' ? await context.db.repositories.users.findById(payload.sub) : null;
    if (!payload || !user) {
      socket.close(4401, 'Unauthorized');
      return;
    }
    const organizationId = payload.org ?? Object.keys(user.organizationRoles)[0];
    if (!organizationId) {
      socket.close(4403, 'No organization');
      return;
    }
    context.logger.info('WebSocket client connected', { organizationId });
    socket.send(JSON.stringify({ type: 'system:connected', organizationId, createdAt: new Date().toISOString() }));
    const unsubscribe = context.bus.subscribe((event) => {
      if (event.organizationId && event.organizationId !== organizationId) return;
      if (socket.readyState === 1) socket.send(JSON.stringify(event));
    });
    socket.on('close', () => {
      unsubscribe();
      context.logger.info('WebSocket client disconnected', { organizationId });
    });
  });

  server.listen(env.PORT, () => {
    context.logger.info('MAKE IT AI API started', {
      port: env.PORT,
      prefix: env.API_PREFIX,
      storage: db.mode,
      providers: context.gateway.listProviders().filter((provider) => provider.configured).map((provider) => provider.id),
    });
  });

  const shutdown = () => {
    websocket.close();
    server.close(() => {
      void db.close().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Failed to start MAKE IT AI API:', error instanceof Error ? error.message : error);
  process.exit(1);
});
