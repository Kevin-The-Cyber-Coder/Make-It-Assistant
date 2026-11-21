# Testing metrics

The testing metrics endpoint summarizes organization-scoped test generation runs.

## API

### `GET /api/v1/dev/testing/metrics`

Requires authentication. Returns:

- `totalRuns` - number of test runs considered (up to the most recent 500)
- `byStatus` - counts by run status
- `generatedTests` - total generated test skeleton files across considered runs
- `latestRun` - latest run metadata or `null`

## Console

The Testing Lab displays total runs, generated test skeleton count, skipped runs, and the latest framework above the generation workspace.
