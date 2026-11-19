import { createFileRepositories, createMemoryRepositories } from './file';
import { createMongoRepositories } from './mongo';
import type { DatabaseConfig, Repositories } from './types';

export * from './types';
export * from './memory';
export { createFileRepositories, createMemoryRepositories } from './file';
export { createMongoRepositories } from './mongo';

export interface DatabaseHandle extends DatabaseConfig {
  repositories: Repositories;
  mode: 'mongodb' | 'json-file' | 'memory';
  close: () => Promise<void>;
}

export async function connectDatabase(config: DatabaseConfig = {}): Promise<DatabaseHandle> {
  if (config.mongoUri) {
    const repositories = await createMongoRepositories(config.mongoUri, config.mongoDb ?? 'make_it_ai');
    return {
      ...config,
      repositories,
      mode: 'mongodb',
      close: async () => undefined,
    };
  }
  if (config.dataDir) {
    return {
      ...config,
      repositories: await createFileRepositories(config.dataDir),
      mode: 'json-file',
      close: async () => undefined,
    };
  }
  return {
    ...config,
    repositories: createMemoryRepositories(),
    mode: 'memory',
    close: async () => undefined,
  };
}
