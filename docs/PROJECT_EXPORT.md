# Project export

The project export endpoint allows authenticated users to download project metadata and indexed file manifest as JSON.

## API

### `GET /api/v1/projects/:id/export`

Requires authentication. Returns a JSON attachment containing:

- `project` - project metadata
- `index` - index timestamp and file count, or `null` when no index is loaded
- `files` - indexed file manifest entries (`path`, `language`, `size`)
- `exportedAt` - export timestamp

The response is sent as `project-<id>.json`. Each export writes a `project.export` audit event.

## Console

The Projects workspace shows an **Export project** button for the selected project, downloading the project JSON through the authenticated API.
