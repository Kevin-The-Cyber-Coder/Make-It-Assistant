# Streaming token usage accounting

SSE streams now carry their own accounting record instead of being billed only as a generic completed response.

## What is emitted

`POST /api/v1/ai/stream` emits a `usage` event after the final chunk and before the `done` event:

```text
event: usage
data: {
  "provider": "local-rules",
  "model": "rule-engine-v1",
  "promptTokens": 12,
  "completionTokens": 34,
  "totalTokens": 46,
  "chunkCount": 7,
  "firstTokenMs": 3,
  "durationMs": 48,
  "estimated": true,
  "success": true
}
```

The `done` event also includes the same `usage` object. On failure, a `usage` event with `success: false` is emitted before the `error` event.

## Where the numbers come from

- The gateway's `StreamUsageTracker` observes every `StreamChunk`. Provider-reported `usage` on any chunk wins; the maximum reported value is kept so a partial final chunk cannot reduce the total.
- When a provider reports no usage (including the offline `local-rules` adapter), tokens are estimated at four characters per token from the serialized request messages and the concatenated stream deltas. `estimated: true` marks these records.
- `firstTokenMs` measures time to the first non-empty delta. `durationMs` measures the whole stream. Both are measured locally and are not provider metrics.

## Persistence and fanout

The API passes `onStreamUsage` into the gateway. Each completed or failed stream writes one `ModelUsage` record with the aggregated prompt/completion tokens and publishes an org-scoped `ai:stream-usage` bus event. The assistant message stores the same `totalTokens` value. `GET /api/v1/analytics/usage` and the overview token totals read those records.

## Boundaries

- Character-based estimates are not a substitute for provider billing data. Do not use them for invoicing.
- A stream that switches providers mid-flight is attributed to the last provider observed; the current adapters do not switch providers after the first chunk.
- One stream produces exactly one usage record. Chat (`/ai/chat`) still records usage separately through `onUsage`.
