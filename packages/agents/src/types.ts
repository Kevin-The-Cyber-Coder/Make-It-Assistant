import type { AgentId, PlanStep, ProjectFile, TaskType } from '@make-it-ai/shared';

export interface AgentArtifact {
  path: string;
  content: string;
}

export interface AgentOutput {
  summary: string;
  artifacts: AgentArtifact[];
  findings?: string[];
  nextSteps?: string[];
}

export interface ExecutionResult {
  exitCode: number;
  output: string;
  durationMs: number;
}

export interface AgentContext {
  organizationId: string;
  userId: string;
  taskId: string;
  projectId?: string;
  objective: string;
  files: ProjectFile[];
  plan: PlanStep[];
  chat: (prompt: string, taskType: TaskType, metadata?: Record<string, unknown>) => Promise<string>;
  emit: (type: string, message: string, payload?: Record<string, unknown>) => void;
  requestApproval: (step: PlanStep, action: string, details: string) => Promise<boolean>;
  executor?: (command: string, files?: ProjectFile[]) => Promise<ExecutionResult>;
  signal: AbortSignal;
  artifacts: AgentArtifact[];
}

export interface Specialist {
  readonly id: AgentId;
  run(context: AgentContext, step: PlanStep): Promise<AgentOutput>;
}
