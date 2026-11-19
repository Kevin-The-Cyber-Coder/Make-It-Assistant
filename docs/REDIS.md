# Redis runtime services

Redis is optional. The API runs without it by using in-process stores.

## What Redis backs

- **Rate limiting** — a fixed-window counter per client IP and route, keyed as `mia:ratelimit:<ip>:<path>`. The counter uses `INCR` plus `EXPIRE ... NX`, so it works across multiple API processes.
- **Task queue** — a FIFO list (`mia:tasks`) using `LPUSH`/`RPOP`, exposed through the authenticated agent queue endpoints.

## What happens without Redis

If `REDIS_URL` is empty, or the initial connection fails after a short retry, the API logs a warning and falls back to in-process `Map`/array stores. `/healthz` reports `redis: "disabled"` and the active `rateLimitStore` / `queueStore` modes. An unexpected runtime error in the limiter is logged and the request is allowed through.

The in-process fallback is per API process. It is not a distributed limit and must not be treated as one in multi-process deployments.

## Configuration

```bash
REDIS_URL=redis://localhost:6379
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
```

`docker-compose.yml` includes a `redis:7-alpine` service. Leave `REDIS_URL` empty to disable the client entirely.

## Queue endpoints

All endpoints are under `/api/v1/agents` and require a bearer token.

- `GET /queue` — `{ mode, length }`.
- `POST /queue` — `{ type, payload }` enqueues a task and returns it with a generated id.
- `POST /queue/dequeue` — pops the oldest task, or returns `NOT_FOUND` when empty.

These endpoints provide queue primitives only. They do not start a worker consumer or claim exactly-once delivery.
