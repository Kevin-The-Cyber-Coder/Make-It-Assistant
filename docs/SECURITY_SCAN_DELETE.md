# Security scan delete

## API

### `DELETE /api/v1/security/scans/:id`

Requires authentication. Owner or admin role required.

Deletes a stored security scan for the authenticated organization. Returns `{ "success": true }` on success. Each deletion writes a `security.scan.delete` audit event.

Returns 404 when the scan does not exist in the organization.

## Console

The Security Center shows a **Delete** button when a scan is loaded, removing the scan through the authenticated API and refreshing security metrics.
