# Readiness and liveness

MAKE IT AI exposes unauthenticated operational endpoints for container and deployment health checks.

## Endpoints

### `GET /healthz`

Liveness-style status endpoint. Returns service identity, storage mode, Redis connection flag, rate-limit and queue store modes, configured provider IDs, and a timestamp. It does not perform dependency probes beyond reporting current process state.

### `GET /readyz`

Readiness endpoint. Performs lightweight dependency checks:

- **storage**: executes a repository count against the active database/storage backend.
- **redis**: pings Redis when a Redis client is connected; reports disabled or configured-but-disconnected when Redis is not connected.

The endpoint returns HTTP 200 with `"status":"ready"` when all checks pass, or HTTP 503 with `"status":"not_ready"` when any check fails. Check details include safe error messages and never expose secrets.
