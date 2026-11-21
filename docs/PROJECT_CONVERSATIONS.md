# Project conversations

## API

### `GET /api/v1/projects/:id/conversations`

Requires authentication. Returns conversations for the authenticated organization that are associated with the specified project, newest first (limit 100).

Returns 404 when the project does not exist in the organization.
