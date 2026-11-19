import { createWorkerApp } from './app';
import { loadWorkerConfig } from './config';

const config = loadWorkerConfig();
const app = createWorkerApp(config);

const server = app.listen(config.port, () => {
  console.log(`[sandbox-worker] listening on http://localhost:${config.port}`);
});

function shutdown(): void {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
