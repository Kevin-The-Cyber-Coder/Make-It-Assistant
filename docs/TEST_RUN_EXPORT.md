# Test run export

The test run export endpoint allows authenticated users to download a test run record as JSON.

## API

### `GET /api/v1/dev/testing/runs/:id/export`

Requires authentication. Returns a JSON attachment containing the test run and `exportedAt` timestamp. The response is sent as `test-run-<id>.json`.

Each export writes a `testing.export` audit event.

## Console

The Testing Lab shows an **Export** button when a test run is loaded, downloading the run JSON through the authenticated API.
