# Agent task export

The agent task export endpoint allows authenticated users to download a task record and its events as JSON.

## API

### `GET /api/v1/agents/tasks/:id/export`

Requires authentication. Returns a JSON attachment containing:

- `task` - agent task record
- `events` - task events
- `exportedAt` - export timestamp

The response is sent as `agent-task-<id>.json`. Each export writes an `agent.task.export` audit event.

## Console

The Agent Console shows an **Export** button for the selected task, downloading the task JSON through the authenticated API.
