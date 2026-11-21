# Project summary

## API

### `GET /api/v1/projects/:id/summary`

Requires authentication. Returns organization-scoped counts for resources associated with the specified project.

```json
{
  "summary": {
    "files": 0,
    "conversations": 0,
    "scans": 0,
    "reviews": 0,
    "testRuns": 0,
    "tasks": 0
  }
}
```

Returns 404 when the project does not exist in the organization.
