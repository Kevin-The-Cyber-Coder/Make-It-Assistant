# Agent task filters

## API

### `GET /api/v1/agents/tasks`

Supports optional query parameters:

- `projectId` - filter tasks for a specific project
- `status` - filter tasks by status
- `q` - filter tasks by objective text
- `limit` - maximum tasks to return (1-200, default 50)
- `offset` - number of tasks to skip (default 0)

Response includes `tasks`, `total`, `limit`, and `offset`.
