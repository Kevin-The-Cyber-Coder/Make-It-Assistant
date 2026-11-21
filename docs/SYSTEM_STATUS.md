# System status

The authenticated system status endpoint exposes safe runtime and storage metadata for operators and the Settings console.

## API

### `GET /api/v1/system/status`

Requires a bearer access token. The response includes:

- service identity, timestamp, uptime, Node.js version, platform and hostname
- storage mode
- Redis configuration/connection state
- rate-limit and queue mode/settings
- configured AI provider IDs, configuration state and model counts
- repository record counts for core organization data

The endpoint does not expose secrets, tokens, raw environment variables, or provider credentials.

## Console

The Settings page displays the status payload in a **Runtime status** panel alongside the existing public `/healthz` check and provider metadata. Values refresh periodically while the page is open.
