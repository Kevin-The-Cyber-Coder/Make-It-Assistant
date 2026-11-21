# AI metrics

## API

### `GET /api/v1/ai/metrics`

Requires authentication. Returns organization-scoped AI conversation and message counts.

```json
{
  "metrics": {
    "totalConversations": 0,
    "totalMessages": 0,
    "byRole": { "user": 0, "assistant": 0 }
  }
}
```
