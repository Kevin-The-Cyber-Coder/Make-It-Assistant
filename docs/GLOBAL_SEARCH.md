# Global search

MAKE IT AI provides an authenticated, organization-scoped search endpoint used by the console command palette (`Ctrl/Cmd+K`).

## API

### `GET /api/v1/search`

| Parameter | Description |
| --- | --- |
| `q` | Required search text, 2–160 characters |
| `limit` | Maximum number of results from 1 to 50, default 12 |

The query is scoped to the authenticated actor's organization. The route searches recent records from projects, conversations, agent tasks, repository connections, security scans, code reviews, test runs, conversation messages and audit logs. Matches are ranked by simple text relevance and recency, then returned with a console destination path.

Response shape:

```json
{
  "query": "build",
  "results": [
    {
      "type": "project",
      "id": "...",
      "title": "...",
      "subtitle": "...",
      "path": "/projects?project=...",
      "score": 120,
      "updatedAt": "2026-..."
    }
  ],
  "total": 1,
  "byType": { "project": 1 }
}
```

## Console

The command palette always filters workspace navigation locally. When the query has at least two characters, it also fetches matching organization records and shows them as typed results. Selecting a result navigates to the relevant workspace; `Enter` opens the first available result.

## Notes

- Search is backed by repository queries against the active storage backend (memory, JSON file or MongoDB). It does not introduce a separate search index in this phase.
- Message search scans recent message records in the organization and can include user or assistant content; access remains limited to authenticated organization members.
- Result paths include identifiers as query parameters where available; the destination workspace may ignore unknown parameters.
