# Project agent tasks

## API

### `GET /api/v1/projects/:id/tasks`

Requires authentication. Returns agent tasks for the authenticated organization associated with the specified project, newest first (limit 100).

Returns 404 when the project does not exist in the organization.
