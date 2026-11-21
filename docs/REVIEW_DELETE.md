# Code review delete

## API

### `DELETE /api/v1/dev/reviews/:id`

Requires authentication. Owner or admin role required.

Deletes a stored code review for the authenticated organization. Returns `{ "success": true }` on success. Each deletion writes a `review.delete` audit event.

Returns 404 when the review does not exist in the organization.

## Console

The Review workspace shows a **Delete** button when a review is loaded, removing the review through the authenticated API and refreshing review history/metrics.
