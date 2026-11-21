# Usage metrics

The usage metrics endpoint summarizes organization-scoped AI gateway usage records.

## API

### `GET /api/v1/analytics/metrics`

Requires authentication. Returns:

- `totalRequests` - number of usage records considered (up to 5000)
- `totalTokens` - prompt + completion tokens across considered records
- `avgLatencyMs` - average gateway latency
- `successRate` - successful request ratio from 0 to 1
- `byProvider` - token totals by provider

## Console

The Analytics workspace displays server-side usage metrics including success rate alongside recent usage charts and request logs.
