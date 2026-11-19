import type {
  AgentEvent,
  AgentTask,
  AuditLog,
  CodeReview,
  Conversation,
  Message,
  ModelUsage,
  Organization,
  Project,
  RepositoryConnection,
  SecurityScan,
  TestRun,
  User,
} from '@make-it-ai/shared';

export type Where = Record<string, unknown>;

export interface Query {
  where?: Where;
  limit?: number;
  offset?: number;
  sort?: { field: string; direction: 'asc' | 'desc' };
}

export interface Repository<T extends { id: string }> {
  create(entity: T): Promise<T>;
  findById(id: string): Promise<T | null>;
  findOne(query: Query): Promise<T | null>;
  find(query?: Query): Promise<T[]>;
  update(id: string, patch: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  count(query?: Query): Promise<number>;
}

export interface Repositories {
  organizations: Repository<Organization>;
  users: Repository<User>;
  projects: Repository<Project>;
  repositories: Repository<RepositoryConnection>;
  conversations: Repository<Conversation>;
  messages: Repository<Message>;
  agentTasks: Repository<AgentTask>;
  agentEvents: Repository<AgentEvent>;
  securityScans: Repository<SecurityScan>;
  codeReviews: Repository<CodeReview>;
  testRuns: Repository<TestRun>;
  modelUsage: Repository<ModelUsage>;
  auditLogs: Repository<AuditLog>;
}

export interface DatabaseConfig {
  mongoUri?: string;
  mongoDb?: string;
  dataDir?: string;
}
