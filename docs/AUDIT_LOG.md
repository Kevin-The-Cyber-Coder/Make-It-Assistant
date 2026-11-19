# Audit log

MAKE IT AI records security-relevant actions in the `auditLogs` repository. The API writes entries through `apps/api/src/lib/audit.ts`, and the authenticated console viewer reads them through the org-scoped audit router.

## API

Both endpoints require a bearer access token. The organization is always taken from the authenticated actor; an `x-organization-id` header cannot expand the query beyond organizations the user belongs to.

### `GET /api/v1/audit`

Returns a newest-first page of audit entries.

| Parameter | Description |
| --- | --- |
| `action` | Exact action name, for example `project.create` |
| `resource` | Exact resource type, for example `project` |
| `actorId` | Exact authenticated actor ID |
| `resourceId` | Exact resource ID or identifier |
| `q` | Case-insensitive text search across action, resource, IDs, IP and metadata |
| `limit` | Page size from 1 to 200, default 50 |
| `offset` | Zero-based offset, default 0 |

Response shape:

```json
{
  "entries": [],
  "total": 0,
  "limit": 50,
  "offset": 0
}
```

Each listing request writes an `audit.read` entry with the active filter names and returned record count. The read audit is written after the query, so it appears in a subsequent refresh rather than in its own response.

### `GET /api/v1/audit/summary`

Returns organization-wide counts grouped by action, resource type and actor:

```json
{
  "total": 0,
  "byAction": [],
  "byResource": [],
  "byActor": []
}
```

## Console

The **Audit Log** workspace is available under **Intelligence** in the sidebar and at `/audit`. It provides full-text and exact filters, a newest-first event table, record detail with metadata JSON, summary counters, and JSON export of the currently loaded page.

## Storage and retention

Audit entries use the same repository abstraction as the rest of the platform: in-memory storage by default, JSON-file storage when `DATA_DIR` is configured, and MongoDB when `MONGODB_URI` is configured. There is no separate retention policy in this phase; retention should be configured at the storage layer. Audit records are append-only through the application API—there is no update or delete route.
