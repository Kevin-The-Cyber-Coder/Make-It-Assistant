# Security scan export

The security scan export endpoint allows authenticated users to download a scan record as JSON.

## API

### `GET /api/v1/security/scans/:id/export`

Requires authentication. Returns a JSON attachment containing the scan, computed risk, and `exportedAt` timestamp. The response is sent as `security-scan-<id>.json`.

Each export writes a `security.scan.export` audit event.

## Console

The Security Center shows an **Export** button when a scan is loaded, downloading the scan JSON through the authenticated API.
