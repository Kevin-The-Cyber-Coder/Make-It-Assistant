# MAKE IT AI

MAKE IT AI is an AI software-engineering and defensive-cybersecurity workspace built as an npm workspaces monorepo. It provides a typed API, a React engineering console, provider-agnostic AI routing, multi-agent orchestration, defensive scanning, GitHub integration and real persistence adapters.

This repository was rebuilt in place from a fork of the Changesets Release GitHub Action. The original action is preserved, unchanged in behavior, under [`tools/changesets-action`](tools/changesets-action).

## What is implemented

| Area | Status | Notes |
| --- | --- | --- |
| API | Implemented | Express 4, versioned `/api/v1`, JWT auth, scrypt password hashing, rotating refresh tokens, org-scoped repositories, RBAC helpers, audit logs, rate limits and security headers. |
| AI Gateway | Implemented | OpenAI, Anthropic and Gemini adapters over `fetch`, model routing, capability registry, fallback chain, context manager, token manager, response normalization, evaluation hooks and SSE streaming. Offline `local-rules` adapter is explicitly labeled. |
| Agents | Implemented | Planner, specialist agents, workflow engine, approval checkpoints, cancellation, tool registry, task/event persistence and WebSocket fanout. Sensitive steps cannot proceed without explicit approval unless `autoApprove` is set. |
| Project intelligence | Implemented | File scanning, language/dependency detection, indexed context and relevance-based context retrieval. |
| Security engine | Implemented | Offline secret detection, SAST rules, insecure-configuration checks, dependency heuristics, OWASP reference catalog and severity summaries. |
| Developer engine | Implemented | Rule-based code review, test-skeleton generation and stack-trace diagnosis. No shell commands are executed. |
| GitHub integration | Implemented | REST client for repositories, commits, pulls, issues and contributors; connect flow; PR review using the same defensive engine plus optional AI summary. |
| Web console | Implemented | React/Vite/Tailwind workspace with dashboard, streaming assistant, agent console, code studio, projects, security, review, testing, debug, GitHub, analytics and settings pages. |
| Persistence | Implemented | In-memory, JSON-file and MongoDB adapters selected by environment configuration. |
| Tests | Implemented | Vitest unit and API integration tests run with `npm test`. |
| CI | Implemented | GitHub Actions install/typecheck/test/build workflow and PR status report workflow. |

## What is deliberately not claimed

- No external AI provider is used unless a key is configured server-side. Responses from `local-rules` are clearly labeled offline heuristic output.
- Test execution is not performed by the testing lab. It generates skeletons and returns `status: skipped` unless an approved isolated sandbox executor is attached.
- Dependency findings are offline heuristics. They are not an authoritative CVE feed; use `npm audit`, `pip-audit`, or equivalent scanners for authoritative data.
- `REDIS_URL` is documented and included in Docker Compose, but Redis is not yet wired into runtime behavior.
- No project license is declared. Third-party notices inside preserved vendor code remain intact.

## Repository layout

```text
apps/
  api/                     Express API and WebSocket server
  web/                     React/Vite engineering console
packages/
  shared/                  Domain types, Zod schemas, errors, event constants
  database/                Repository interfaces and memory/file/Mongo adapters
  ai-gateway/              Routing, adapters, context, fallback and evaluation
  agents/                  Planner, specialists, workflow and approvals
  project-intelligence/    Scanning, indexing and context retrieval
  security-engine/         Defensive static analysis and OWASP education
  dev-engine/              Code review, test generation and debugging
  github-integration/      GitHub REST client and PR review
tools/
  changesets-action/       Preserved original Changesets action
scripts/
  compliance-report.mjs    Generates a real repository status report
.github/workflows/         CI and PR status workflows
```

## Quick start

Requirements: Node.js 20 or newer (Node 22 recommended) and npm.

```bash
npm install
cp .env.example .env
npm run dev
```

The API listens on `http://localhost:4000` and the web console on `http://localhost:5173` when both dev processes are started. The root `dev` script starts the API; use `npm run dev:web` in a second terminal for the web app.

To use MongoDB instead of JSON-file storage, set `MONGODB_URI` and start the local services:

```bash
docker compose up -d mongo redis
```

Leave `MONGODB_URI` empty for the default JSON-file repository under `.data/`.

## Environment

See [`.env.example`](.env.example) for the full contract. Important variables:

- `JWT_SECRET`: must be at least 32 characters in production.
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`: server-side provider credentials. Never commit real values.
- `AI_FALLBACK_ORDER`: provider priority; `local-rules` is the last safe fallback.
- `MONGODB_URI`: when set, selects MongoDB; otherwise JSON-file storage is used.
- `GITHUB_TOKEN`: optional server-wide GitHub token. The web UI also accepts a session-only token.
- `CLIENT_ORIGIN`: comma-separated exact origins allowed by CORS.

## Verification

```bash
npm run typecheck
npm test
npm run build
npm run compliance
```

`npm run compliance` prints a generated report based on actual Git history, tracked files and environment presence. It never prints secret values and does not claim review approval or external validation.

## API overview

- `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `GET /api/v1/auth/me`
- `GET|POST /api/v1/projects`, `POST /api/v1/projects/:id/index`
- `GET|POST /api/v1/conversations`, `GET /api/v1/conversations/:id/messages`
- `POST /api/v1/ai/chat`, `POST /api/v1/ai/stream`, `GET /api/v1/ai/providers`
- `GET|POST /api/v1/agents/tasks`, `POST /api/v1/agents/tasks/:id/approve`, `POST /api/v1/agents/tasks/:id/cancel`
- `POST /api/v1/security/scan`, `GET /api/v1/security/owasp`
- `POST /api/v1/dev/code/review`, `POST /api/v1/dev/testing/run`, `POST /api/v1/dev/debug/analyze`
- `GET /api/v1/github/connections`, `GET /api/v1/github/repos`, `POST /api/v1/github/connect`
- `GET /api/v1/analytics/overview`, `GET /api/v1/analytics/usage`
- `GET /healthz`, `/ws?token=<access-token>`

Full request contracts are defined in [`packages/shared/src/schemas.ts`](packages/shared/src/schemas.ts) and documented in [`docs/API.md`](docs/API.md).

## Security model

- Organization isolation is enforced in repositories and in middleware.
- WebSocket upgrade requires a valid access-token query parameter and org-scoped subscriptions.
- Request bodies are validated with Zod before reaching handlers.
- Passwords use scrypt with per-user salts; refresh tokens are hashed before storage.
- File content from repositories is treated as untrusted data, never as instructions.
- Sensitive agent steps require explicit human approval unless explicitly auto-approved.
- Code execution is not enabled by default; there is no arbitrary command endpoint.
- Security scanning is defensive and intended for authorized systems only.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API contracts](docs/API.md)
- [Local setup and operations](docs/LOCAL_SETUP.md)
- [Security posture](docs/SECURITY.md)
- [Roadmap and known gaps](docs/ROADMAP.md)
- [Preserved legacy action](tools/changesets-action/README.md)

## License

No project license is declared at the repository root. Third-party notices in preserved upstream files remain intact.
