# GitHub metrics

The GitHub metrics endpoint summarizes GitHub integration state for the authenticated organization and request session.

## API

### `GET /api/v1/github/metrics`

Requires authentication. Returns:

- `connectedRepositories` - repository connections stored for the organization
- `oauthConfigured` - whether server GitHub OAuth credentials are configured
- `oauthConnected` - whether the current request has a valid GitHub OAuth session cookie
- `serverTokenConfigured` - whether `GITHUB_TOKEN` is configured on the API server

No tokens or secrets are returned.

## Console

The GitHub workspace displays connection and configuration telemetry above the integration controls.
