# Code review export

The code review export endpoint allows authenticated users to download a review record as JSON.

## API

### `GET /api/v1/dev/reviews/:id/export`

Requires authentication. Returns a JSON attachment containing the review and `exportedAt` timestamp. The response is sent as `code-review-<id>.json`.

Each export writes a `review.export` audit event.

## Console

The Review workspace shows an **Export** button when a review is loaded, downloading the review JSON through the authenticated API.
