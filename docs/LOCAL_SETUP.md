# Local setup and operations

## Install

```bash
node --version   # 20+ required, 22 recommended
npm --version
npm install
```

## Configure

```bash
cp .env.example .env
```

Edit `.env` only with non-production values locally. Recommended development defaults:

- Leave provider keys empty to use the deterministic offline adapter.
- Leave `MONGODB_URI` empty to use JSON files in `.data/`.
- Replace `JWT_SECRET` with a long random string even in development.

## Run

```bash
npm run dev        # API on http://localhost:4000
npm run dev:web    # Web on http://localhost:5173
```

Open the web app, register a workspace and sign in. The web development server proxies `/api` and `/ws` to the API.

## Optional MongoDB and Redis

```bash
docker compose up -d mongo redis
```

Then set `MONGODB_URI=mongodb://localhost:27017` in `.env`. Redis is started for future use; the current runtime does not require it.

Stop services with `docker compose down`.

## Verify

```bash
npm run typecheck
npm test
npm run build
npm run compliance
```

## Production notes

- Set `NODE_ENV=production` and a `JWT_SECRET` of at least 32 characters or startup validation fails.
- Configure exact `CLIENT_ORIGIN` values; wildcard origins with credentials are unsafe.
- Terminate TLS at a reverse proxy and forward WebSocket upgrade headers.
- Keep provider and GitHub tokens in the deployment secret store.
- Attach an isolated sandbox worker only after implementing explicit approval, resource limits and audit logging for command execution.
