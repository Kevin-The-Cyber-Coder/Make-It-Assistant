import { AGENT_EVENTS, type AgentId, type PlanStep, type ProjectFile } from '@make-it-ai/shared';

function step(agent: AgentId, title: string, description: string, requiresApproval = false): PlanStep {
  return {
    id: crypto.randomUUID(),
    agent,
    title,
    description,
    status: 'pending',
    requiresApproval,
  };
}

export function createPlan(objective: string, files: ProjectFile[]): PlanStep[] {
  const text = objective.toLowerCase();
  const plan: PlanStep[] = [];

  if (/architect|design|structure|stack|schema|api/.test(text)) {
    plan.push(step('architect', 'Design architecture', 'Produce layers, technology choices, data model and API boundaries.'));
  }
  if (/build|implement|create|develop|feature|app/.test(text)) {
    plan.push(step('developer', 'Implement changes', 'Generate the code changes required by the objective.', true));
  }
  if (/bug|error|fix|debug|fail|crash/.test(text)) {
    plan.push(step('debugger', 'Diagnose failure', 'Analyze the error, identify the root cause and propose a correction.'));
  }
  if (/test|coverage|spec/.test(text)) {
    plan.push(step('testing', 'Generate tests', 'Create unit/integration test skeletons and an execution plan.'));
  }
  if (/secur|vulnerab|owasp|secret|risk/.test(text)) {
    plan.push(step('security', 'Defensive security review', 'Scan for secrets, injection sinks and insecure configuration.'));
  }
  if (/review|quality|refactor|pull request|pr /.test(text)) {
    plan.push(step('reviewer', 'Review code', 'Check correctness, duplication, security and maintainability.'));
  }
  if (/document|readme|doc/.test(text)) {
    plan.push(step('documentation', 'Write documentation', 'Generate setup, usage and architecture documentation.'));
  }
  if (/deploy|ci|docker|pipeline|devops/.test(text)) {
    plan.push(step('devops', 'Plan delivery', 'Propose build, CI and deployment configuration.'));
  }

  if (plan.length === 0) {
    plan.push(step('architect', 'Clarify approach', 'Analyze the objective and propose an implementation approach.'));
    plan.push(step('developer', 'Draft solution', 'Draft a concrete solution with file-level guidance.', true));
  }

  if (files.length > 0) {
    plan.unshift(step('orchestrator', 'Index project context', `Analyze ${files.length} supplied project files before planning further.`));
  }
  plan.push(step('orchestrator', 'Summarize results', 'Aggregate outputs, list changes and present next steps.'));
  return plan;
}

export function planningEvent(taskId: string, organizationId: string, plan: PlanStep[]) {
  return {
    type: AGENT_EVENTS.TASK_PLANNING,
    message: `Created ${plan.length}-step plan: ${plan.map((item) => item.title).join(' -> ')}`,
    payload: { steps: plan.map((item) => ({ id: item.id, agent: item.agent, title: item.title })) },
    taskId,
    organizationId,
  };
}
