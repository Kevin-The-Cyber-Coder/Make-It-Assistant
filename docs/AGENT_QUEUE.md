# Agent queue visibility

The Agent Console surfaces the current agent queue mode and queued task count.

## API

### `GET /api/v1/agents/queue`

Requires authentication. Returns:

```json
{ "mode": "memory", "length": 0 }
```

`mode` reflects the active queue backend (`memory` or `redis`), and `length` reports the current queued task count.

## Console

The Agent Console includes a Queue stat card showing queued task count and queue mode alongside agent task metrics.
