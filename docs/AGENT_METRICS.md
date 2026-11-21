# Agent task metrics

The agent metrics endpoint provides a lightweight organization-scoped summary of agent task execution.

## API

### `GET /api/v1/agents/metrics`

Requires authentication. Returns aggregate task metrics for the authenticated organization:

```json
{
  "metrics": {
    "total": 0,
    "byStatus": {},
    "completedLast24h": 0,
    "failedLast24h": 0,
    "awaitingApproval": 0,
    "running": 0,
    "avgCompletionMs": null
  }
}
```

`avgCompletionMs` is computed from completed tasks as `updatedAt - createdAt` and is `null` when no completed durations are available.

## Console

The Agent Console displays total, running, awaiting-approval and average completion metrics above the task history and execution plan.
