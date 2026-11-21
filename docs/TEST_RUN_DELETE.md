# Test run delete

## API

### `DELETE /api/v1/dev/testing/runs/:id`

Requires authentication. Owner or admin role required.

Deletes a stored test run for the authenticated organization. Returns `{ "success": true }` on success. Each deletion writes a `testing.delete` audit event.

Returns 404 when the test run does not exist in the organization.
