# Project security scans

## API

### `GET /api/v1/projects/:id/scans`

Requires authentication. Returns security scans for the authenticated organization associated with the specified project, newest first (limit 100).

Returns 404 when the project does not exist in the organization.
