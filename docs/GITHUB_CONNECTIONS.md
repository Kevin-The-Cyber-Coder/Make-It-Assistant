# GitHub connection management

## API

### `DELETE /api/v1/github/connections/:id`

Requires authentication. Owner or admin role required.

Deletes a stored GitHub repository connection for the authenticated organization. Returns `{ "success": true }` on success. Each deletion writes a `github.disconnect` audit event.

Returns 404 when the connection does not exist in the organization.

## Console

The GitHub workspace lists connected repositories with a disconnect action that calls the authenticated delete endpoint and refreshes connections/metrics.
