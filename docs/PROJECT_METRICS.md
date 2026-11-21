# Project metrics

The project metrics endpoint summarizes organization-scoped project and indexing activity.

## API

### `GET /api/v1/projects/metrics`

Requires authentication. Returns:

- `totalProjects` - total projects in the organization
- `indexedProjects` - projects with an in-memory index currently loaded
- `indexedFiles` - total files across loaded project indexes
- `updatedLast24h` - projects updated in the last 24 hours

Indexed file counts reflect indexes currently loaded in the API process; they reset when the process restarts until projects are indexed again.

## Console

The Projects workspace displays total projects, indexed projects, indexed files, and recently updated project counts above the workspace.
