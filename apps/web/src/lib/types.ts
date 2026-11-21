export interface Project {
  id: string;
  name: string;
  description: string;
  languages: string[];
  frameworks: string[];
  updatedAt: string;
}

export interface AgentTask {
  id: string;
  objective: string;
  status: string;
  plan: Array<{ id: string; agent: string; title: string; description: string; status: string; requiresApproval: boolean; output?: string }>;
  result?: string;
  error?: string;
  createdAt: string;
}

export interface AgentEvent {
  id: string;
  taskId: string;
  type: string;
  message: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface AgentMetrics {
  total: number;
  byStatus: Record<string, number>;
  completedLast24h: number;
  failedLast24h: number;
  awaitingApproval: number;
  running: number;
  avgCompletionMs: number | null;
}

export interface ReviewFinding {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  filePath: string;
  line?: number;
  suggestion?: string;
}

export interface SecurityFinding {
  id: string;
  severity: string;
  category: string;
  title: string;
  description: string;
  filePath?: string;
  line?: number;
  remediation: string;
}

export interface SecurityScan {
  id: string;
  filesScanned: number;
  findings: SecurityFinding[];
  summary: Record<string, number>;
  createdAt: string;
}

export interface SecurityMetrics {
  totalScans: number;
  scansLast24h: number;
  cumulativeFindingsBySeverity: Record<string, number>;
  latestScan: {
    id: string;
    createdAt: string;
    filesScanned: number;
    findings: number;
    summary: Record<string, number>;
    risk: string;
  } | null;
}

export interface TestingMetrics {
  totalRuns: number;
  byStatus: Record<string, number>;
  generatedTests: number;
  latestRun: { id: string; status: string; framework: string; createdAt: string } | null;
}

export interface ReviewMetrics {
  totalReviews: number;
  totalFindings: number;
  bySeverity: Record<string, number>;
  latestReview: { id: string; title: string; findings: number; createdAt: string } | null;
}

export interface ProjectMetrics {
  totalProjects: number;
  indexedProjects: number;
  indexedFiles: number;
  updatedLast24h: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider?: string;
  model?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  organizationId?: string;
  actorId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

export interface SearchResult {
  type: 'project' | 'conversation' | 'task' | 'repository' | 'scan' | 'review' | 'test-run' | 'message' | 'audit';
  id: string;
  title: string;
  subtitle: string;
  path: string;
  score: number;
  updatedAt?: string;
}

export interface SystemStatus {
  status: string;
  service: string;
  timestamp: string;
  uptimeSeconds: number;
  nodeVersion: string;
  platform: string;
  hostname: string;
  storage: { mode: string };
  redis: { configured: boolean; connected: boolean };
  rateLimit: { mode: string; windowMs: number; max: number };
  queue: { mode: string };
  providers: Array<{ id: string; configured: boolean; models: number }>;
  counts: Record<string, number>;
}

export interface Overview {
  totalProjects: number;
  activeAgentTasks: number;
  completedTasks: number;
  connectedRepositories: number;
  recentCommits: Array<{ sha: string; message: string; author: string; date: string; url: string }>;
  codeReviews: number;
  securityFindings: Record<string, number>;
  testRuns: number;
  aiRequests: number;
  tokensUsed: number;
  providerUsage: Record<string, number>;
  storageMode: string;
  recentConversations: Array<{ id: string; title: string; updatedAt: string }>;
}
