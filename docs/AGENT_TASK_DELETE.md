# Agent task delete

## API

### `DELETE /api/v1/agents/tasks/:id`

Requires authentication. Owner or admin role required.

Deletes a stored agent task for the authenticated organization. Running or approval-waiting tasks must be cancelled before deletion. Returns `{ "success": true }` on success. Each deletion writes an `agent.task.delete` audit event.

Returns 404 when the task does not exist in the organization.

## Console

The Agent Console shows a **Delete** button for the selected task. Delete is disabled while a task is running or awaiting approval; after deletion the task list and metrics refresh.
