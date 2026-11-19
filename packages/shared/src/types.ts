export type ID = string;
export type ISODate = string;

export type Role = 'owner' | 'admin' | 'developer' | 'viewer';

export interface Organization {
  id: ID;
  name: string;
  slug: string;
  createdAt: ISODate;
}

export interface User {
  id: ID;
  email: string;
  name: string;
  passwordHash: string;
  organizationRoles: Record<ID, Role>;
  createdAt: ISODate;
}

export interface Project {
  id: ID;
  organizationId: ID;
  name: string;
  description: string;
  rootPath?: string;
  languages: string[];
  frameworks: string[];
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface RepositoryConnection {
  id: ID;
  organizationId: ID;
  provider: 'github';
  owner: string;
  name: string;
  defaultBranch: string;
  htmlUrl: string;
  tokenRef?: string;
  createdAt: ISODate;
}

export interface Conversation {
  id: ID;
  organizationId: ID;
  userId: ID;
  projectId?: ID;
  title: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type MessageRole = 'system' | 'user' | 'assistant';

export type TaskType =
  | 'general'
  | 'explain'
  | 'generate'
  | 'security'
  | 'debug'
  | 'documentation'
  | 'architecture';

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface Message {
  id: ID;
  organizationId: ID;
  conversationId: ID;
  role: MessageRole;
  content: string;
  provider?: string;
  model?: string;
  tokens?: number;
  createdAt: ISODate;
}

export type TaskStatus =
  | 'created'
  | 'planning'
  | 'awaiting_approval'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AgentId =
  | 'orchestrator'
  | 'architect'
  | 'developer'
  | 'debugger'
  | 'testing'
  | 'security'
  | 'reviewer'
  | 'documentation'
  | 'devops';

export type PlanStepStatus = 'pending' | 'running' | 'awaiting_approval' | 'done' | 'failed' | 'skipped';

export interface PlanStep {
  id: ID;
  agent: AgentId;
  title: string;
  description: string;
  status: PlanStepStatus;
  requiresApproval: boolean;
  approved?: boolean;
  output?: string;
  error?: string;
}

export interface AgentTask {
  id: ID;
  organizationId: ID;
  userId: ID;
  projectId?: ID;
  objective: string;
  status: TaskStatus;
  plan: PlanStep[];
  result?: string;
  error?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type AgentEventType =
  | 'agent:task:created'
  | 'agent:task:planning'
  | 'agent:task:running'
  | 'agent:tool:started'
  | 'agent:tool:completed'
  | 'agent:approval:required'
  | 'agent:task:completed'
  | 'agent:task:failed'
  | 'agent:task:cancelled';

export interface AgentEvent {
  id: ID;
  organizationId: ID;
  taskId: ID;
  type: AgentEventType;
  message: string;
  payload?: Record<string, unknown>;
  createdAt: ISODate;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SecurityFinding {
  id: ID;
  organizationId: ID;
  projectId?: ID;
  scanId: ID;
  severity: Severity;
  category: string;
  title: string;
  description: string;
  filePath?: string;
  line?: number;
  evidence?: string;
  remediation: string;
  references: string[];
  createdAt: ISODate;
}

export interface SecurityScan {
  id: ID;
  organizationId: ID;
  projectId?: ID;
  status: 'queued' | 'running' | 'completed' | 'failed';
  filesScanned: number;
  findings: SecurityFinding[];
  summary: Record<Severity, number>;
  createdAt: ISODate;
  completedAt?: ISODate;
}

export interface ReviewFinding {
  id: ID;
  category: 'bug' | 'security' | 'performance' | 'style' | 'duplication' | 'test';
  severity: Severity;
  title: string;
  description: string;
  filePath: string;
  line?: number;
  suggestion?: string;
}

export interface CodeReview {
  id: ID;
  organizationId: ID;
  projectId?: ID;
  title: string;
  findings: ReviewFinding[];
  summary: string;
  createdAt: ISODate;
}

export interface TestRun {
  id: ID;
  organizationId: ID;
  projectId?: ID;
  status: 'queued' | 'running' | 'passed' | 'failed' | 'skipped';
  framework: string;
  command: string;
  passed: number;
  failed: number;
  durationMs: number;
  output: string;
  generatedTests: Array<{ filePath: string; content: string }>;
  createdAt: ISODate;
}

export interface ModelUsage {
  id: ID;
  organizationId: ID;
  userId: ID;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  success: boolean;
  createdAt: ISODate;
}

export interface AuditLog {
  id: ID;
  organizationId?: ID;
  actorId?: ID;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  createdAt: ISODate;
}

export interface ProjectFile {
  path: string;
  content: string;
  language: string;
  size: number;
}

export interface ProjectIndex {
  projectId: ID;
  files: ProjectFile[];
  languages: string[];
  frameworks: string[];
  entryPoints: string[];
  dependencies: Record<string, string>;
  indexedAt: ISODate;
}
