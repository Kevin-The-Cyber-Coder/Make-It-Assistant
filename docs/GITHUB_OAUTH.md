# GitHub browser OAuth

The API can run a standard GitHub OAuth app flow so users authorize with their own GitHub account instead of pasting a personal access token.

## Configuration

Create a GitHub OAuth app and register this callback URL exactly:

```text
http://localhost:4000/api/v1/github/oauth/callback
```

Then set:

```bash
GITHUB_OAUTH_CLIENT_ID=...
GITHUB_OAUTH_CLIENT_SECRET=...
GITHUB_OAUTH_REDIRECT_URI=http://localhost:4000/api/v1/github/oauth/callback
GITHUB_OAUTH_SCOPES=repo,read:user
GITHUB_OAUTH_COOKIE_SAMESITE=lax
CLIENT_ORIGIN=http://localhost:5173
```

The client ID and secret must be set together or env validation fails. For a production deployment where the API and web app are on different registrable domains, use `GITHUB_OAUTH_COOKIE_SAMESITE=none` over HTTPS so the cookie reaches cross-site API calls.

## Flow

1. `GET /api/v1/github/oauth/start` (authenticated) returns an `authorizeUrl`. Its `state` is an HMAC-signed payload with a 10-minute expiry, bound to the current user and organization.
2. The browser navigates to GitHub. GitHub redirects to `/api/v1/github/oauth/callback` with `code` and `state`.
3. The callback verifies the state signature and expiry, exchanges the code for a token, and looks up the GitHub login.
4. The token is encrypted with AES-256-GCM using a key derived from `JWT_SECRET`, placed in an HTTP-only cookie scoped to the API prefix, and the browser is redirected to `${CLIENT_ORIGIN}/github?oauth=connected`.
5. `GET /api/v1/github/oauth/status` reports connection state without ever returning the token. `POST /api/v1/github/oauth/disconnect` clears the cookie.
6. Existing GitHub routes prefer the OAuth cookie token, then `X-GitHub-Token`, then the server `GITHUB_TOKEN`.

## Boundaries

- The access token never reaches JavaScript: it is sealed into an HTTP-only cookie and decrypted server-side.
- The cookie lives for 8 hours and is not refreshed. Disconnect or expiry requires a new authorization.
- OAuth is disabled when the client id/secret/redirect URI are absent; the token field and server token keep working.
- `state` prevents CSRF and login-CSRF on the callback, but the callback does not create or link MAKE IT AI accounts. It only binds a token to the already-authenticated user encoded in the state.
- No token is written to the database or to disk. This is session-scoped, not a durable credential vault.
- Do not treat the cookie as a multi-process secret store: all API processes must share the same `JWT_SECRET` to read each other's cookies.
