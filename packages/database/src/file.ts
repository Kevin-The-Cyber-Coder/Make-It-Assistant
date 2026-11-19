import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { InMemoryRepository } from './memory';
import type { DatabaseConfig, Repositories, Repository } from './types';

const COLLECTIONS = [
  'organizations',
  'users',
  'projects',
  'repositories',
  'conversations',
  'messages',
  'agentTasks',
  'agentEvents',
  'securityScans',
  'codeReviews',
  'testRuns',
  'modelUsage',
  'auditLogs',
] as const;

type CollectionName = (typeof COLLECTIONS)[number];

type EntityRepository = Repository<{ id: string }>;

function asEntityRepository(repository: Repositories[CollectionName]): EntityRepository {
  return repository as unknown as EntityRepository;
}

function createRepositories(
  factory: (name: CollectionName, onChange?: () => void) => Repositories[CollectionName],
): Repositories {
  return {
    organizations: factory('organizations'),
    users: factory('users'),
    projects: factory('projects'),
    repositories: factory('repositories'),
    conversations: factory('conversations'),
    messages: factory('messages'),
    agentTasks: factory('agentTasks'),
    agentEvents: factory('agentEvents'),
    securityScans: factory('securityScans'),
    codeReviews: factory('codeReviews'),
    testRuns: factory('testRuns'),
    modelUsage: factory('modelUsage'),
    auditLogs: factory('auditLogs'),
  } as Repositories;
}

export async function createFileRepositories(dataDir: string): Promise<Repositories> {
  await mkdir(dataDir, { recursive: true });
  const dirty = new Set<CollectionName>();
  let timer: NodeJS.Timeout | undefined;

  const flush = async () => {
    const pending = [...dirty];
    dirty.clear();
    await Promise.all(
      pending.map(async (name) => {
        const repo = asEntityRepository(repositories[name]);
        const target = join(dataDir, `${name}.json`);
        const temp = join(dataDir, `${name}.json.tmp`);
        await writeFile(temp, JSON.stringify(await repo.find(), null, 2), 'utf8');
        await rename(temp, target);
      }),
    );
  };

  const schedule = (name: CollectionName) => {
    dirty.add(name);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush(), 150);
    timer.unref?.();
  };

  const repositories = createRepositories((name) => {
    return new InMemoryRepository([], () => schedule(name)) as Repositories[CollectionName];
  });

  await Promise.all(
    COLLECTIONS.map(async (name) => {
      try {
        const raw = await readFile(join(dataDir, `${name}.json`), 'utf8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        const repo = asEntityRepository(repositories[name]);
        for (const item of parsed) {
          if (item && typeof item.id === 'string') await repo.create(item);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }),
  );

  return repositories;
}

export function createMemoryRepositories(): Repositories {
  return createRepositories((name) => new InMemoryRepository() as Repositories[CollectionName]);
}
