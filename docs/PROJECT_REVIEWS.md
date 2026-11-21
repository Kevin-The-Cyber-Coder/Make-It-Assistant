# Project code reviews

## API

### `GET /api/v1/projects/:id/reviews`

Requires authentication. Returns code reviews for the authenticated organization associated with the specified project, newest first (limit 100).

Returns 404 when the project does not exist in the organization.
