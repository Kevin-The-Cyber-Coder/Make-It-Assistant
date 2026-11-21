# Code review detail

## API

### `GET /api/v1/dev/reviews/:id`

Requires authentication. Returns a single code review record for the authenticated organization.

```json
{ "review": { "id": "...", "title": "...", "summary": "...", "findings": [] } }
```

Returns 404 when the review does not exist in the organization.
