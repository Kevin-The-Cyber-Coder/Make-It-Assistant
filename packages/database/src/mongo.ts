import type { Query, Repositories } from './types';

// mongodb is an optional dependency. It is only loaded when MONGODB_URI is configured.
async function loadMongo(): Promise<any | null> {
  try {
    return await import('mongodb');
  } catch {
    return null;
  }
}

function toMongoFilter(where: Record<string, unknown> = {}): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(where)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const op: Record<string, unknown> = {};
      for (const [operator, operand] of Object.entries(value)) {
        const mapped: Record<string, string> = {
          $contains: '$regex',
          $exists: '$exists',
        };
        const name = mapped[operator] ?? operator;
        op[name] = operator === '$contains' ? String(operand).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : operand;
      }
      filter[key] = op;
    } else {
      filter[key] = value;
    }
  }
  return filter;
}

export async function createMongoRepositories(uri: string, dbName: string): Promise<Repositories> {
  const mongodbModule = await loadMongo();
  if (!mongodbModule) {
    throw new Error('MONGODB_URI is set but the optional "mongodb" package is not installed. Run npm install.');
  }
  const client = new mongodbModule.MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(dbName);

  const names = [
    'organizations', 'users', 'projects', 'repositories', 'conversations', 'messages',
    'agentTasks', 'agentEvents', 'securityScans', 'codeReviews', 'testRuns', 'modelUsage', 'auditLogs',
  ] as const;

  const collections = Object.fromEntries(names.map((name) => [name, db.collection(name)]));

  const repo = <T extends { id: string }>(name: (typeof names)[number]) => ({
    async create(entity: T) {
      await collections[name].insertOne({ ...entity, _id: entity.id });
      return entity;
    },
    async findById(id: string) {
      return collections[name].findOne({ _id: id }, { projection: { _id: 0 } }) as Promise<T | null>;
    },
    async findOne(query: Query) {
      return collections[name].findOne(toMongoFilter(query.where), { projection: { _id: 0 } }) as Promise<T | null>;
    },
    async find(query: Query = {}) {
      let cursor = collections[name].find(toMongoFilter(query.where), { projection: { _id: 0 } });
      if (query.sort) cursor = cursor.sort({ [query.sort.field]: query.sort.direction === 'asc' ? 1 : -1 });
      if (query.offset) cursor = cursor.skip(query.offset);
      if (query.limit) cursor = cursor.limit(query.limit);
      return cursor.toArray() as Promise<T[]>;
    },
    async update(id: string, patch: Partial<T>) {
      const result = await collections[name].findOneAndUpdate(
        { _id: id },
        { $set: patch },
        { returnDocument: 'after', projection: { _id: 0 } },
      );
      return (result as unknown as { value?: T })?.value ?? null;
    },
    async delete(id: string) {
      const result = await collections[name].deleteOne({ _id: id });
      return result.deletedCount === 1;
    },
    async count(query: Query = {}) {
      return collections[name].countDocuments(toMongoFilter(query.where));
    },
  });

  await Promise.all(
    names.map((name) =>
      collections[name].createIndex({ organizationId: 1, createdAt: -1 }).catch(() => undefined),
    ),
  );

  return {
    organizations: repo(names[0]),
    users: repo(names[1]),
    projects: repo(names[2]),
    repositories: repo(names[3]),
    conversations: repo(names[4]),
    messages: repo(names[5]),
    agentTasks: repo(names[6]),
    agentEvents: repo(names[7]),
    securityScans: repo(names[8]),
    codeReviews: repo(names[9]),
    testRuns: repo(names[10]),
    modelUsage: repo(names[11]),
    auditLogs: repo(names[12]),
  } as unknown as Repositories;
}
