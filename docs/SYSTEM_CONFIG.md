# System configuration summary

The system configuration endpoint exposes a safe, non-secret summary of runtime feature configuration.

## API

### `GET /api/v1/system/config`

Requires authentication. Returns safe configuration flags and modes:

- storage/database mode and Mongo/Redis configuration state
- queue and rate-limit modes
- GitHub OAuth/server token configured flags
- sandbox configured flag (`SANDBOX_URL` present)
- OSV enabled flag
- configured AI provider IDs and total provider count

The endpoint never returns secret values, tokens, credentials, or raw environment variables.

## Console

The Settings page displays this summary in a **Configuration** panel alongside runtime status and service metadata.
