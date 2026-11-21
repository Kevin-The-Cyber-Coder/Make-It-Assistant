# Security metrics

The security metrics endpoint summarizes organization-scoped scan history.

## API

### `GET /api/v1/security/metrics`

Requires authentication. Returns:

- `totalScans` - number of scans considered (up to the most recent 500)
- `scansLast24h` - scans created in the last 24 hours
- `cumulativeFindingsBySeverity` - summed severity counts across considered scans
- `latestScan` - latest scan metadata, summary, and computed risk, or `null`

Cumulative counts are aggregated across scan records and are intended as dashboard telemetry, not deduplicated vulnerability inventory.

## Console

The Security Center displays total scans, recent scan activity, cumulative critical findings, and latest risk above the scan workspace.
