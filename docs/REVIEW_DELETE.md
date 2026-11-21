# Code review delete

## API

### `DELETE /api/v1/dev/reviews/:id`

Requires authentication. Owner or admin role required.

Deletes a stored code review for the authenticated organization. Returns `{ "success": true }` on success. Each deletion writes a `review.delete` audit event.

Returns 404 when the review does not exist in the organization.
