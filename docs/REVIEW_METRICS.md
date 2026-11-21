# Review metrics

The review metrics endpoint summarizes organization-scoped code review records.

## API

### `GET /api/v1/dev/reviews/metrics`

Requires authentication. Returns:

- `totalReviews` - number of review records considered (up to the most recent 500)
- `totalFindings` - total findings across considered reviews
- `bySeverity` - finding counts by severity
- `latestReview` - latest review metadata or `null`

## Console

The Code Reviews workspace displays total reviews, total findings, critical/high findings, and latest review finding count above the review workspace.
