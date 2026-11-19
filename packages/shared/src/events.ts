import type { AgentEvent, AgentEventType } from './types';

export const AGENT_EVENTS = {
  TASK_CREATED: 'agent:task:created',
  TASK_PLANNING: 'agent:task:planning',
  TASK_RUNNING: 'agent:task:running',
  TOOL_STARTED: 'agent:tool:started',
  TOOL_COMPLETED: 'agent:tool:completed',
  APPROVAL_REQUIRED: 'agent:approval:required',
  TASK_COMPLETED: 'agent:task:completed',
  TASK_FAILED: 'agent:task:failed',
  TASK_CANCELLED: 'agent:task:cancelled',
} as const satisfies Record<string, AgentEventType>;

export const SYSTEM_EVENTS = {
  CONNECTED: 'system:connected',
  PING: 'system:ping',
} as const;

export function makeAgentEvent(
  taskId: string,
  organizationId: string,
  type: AgentEventType,
  message: string,
  payload?: Record<string, unknown>,
): AgentEvent {
  return {
    id: crypto.randomUUID(),
    organizationId,
    taskId,
    type,
    message,
    payload,
    createdAt: new Date().toISOString(),
  };
}
