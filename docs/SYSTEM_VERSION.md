# System version

The system version endpoint exposes safe build/runtime identity metadata.

## API

### `GET /api/v1/system/version`

Requires authentication. Returns:

- `name` / `service`
- `version` - read from the repository `package.json` when available
- `nodeVersion`, `platform`
- `startedAt` - API process start timestamp
- `timestamp` - current response timestamp
- `commit` - optional commit SHA from `GIT_COMMIT_SHA` or `VERCEL_GIT_COMMIT_SHA`, otherwise `null`

No secrets or environment dumps are exposed.

## Console

The Settings service panel displays the reported version and commit SHA when available.
