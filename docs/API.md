# API contracts

All application routes are mounted under `/api/v1`. `GET /healthz` and `GET /readyz` are unversioned. Every route except auth registration/login/refresh and health/readiness requires `Authorization: Bearer <access-token>`.

## Response envelope

Successful responses return JSON objects such as `{ "project": { ... } }` or `{ "repositories": [...] }`. Errors use:

```json
{ "error": { "code": "BAD_REQUEST", "message": "..." }, "requestId": "..." }
```

## Auth

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| POST | `/auth/register` | `email`, `name`, `password` (min 12), optional `organizationName` | User without password hash plus access/refresh tokens |
| POST | `/auth/login` | `email`, `password` | User and tokens |
| POST | `/auth/refresh` | `refreshToken` | Rotated token pair |
| POST | `/auth/logout` | `refreshToken` | Revokes the stored refresh token |
| GET | `/auth/me` | — | Public user and current actor |

## AI

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/ai/providers` | Provider ids, configured booleans, models. No keys are returned. |
| GET | `/ai/models` | Flattened model catalog. |
| POST | `/ai/enhance` | Adds explicit constraints to a prompt locally. |
| POST | `/ai/chat` | Validated `chatSchema`; persists user and assistant messages. |
| POST | `/ai/stream` | SSE events `chunk`, `done`, `error`. |

`taskType` is one of `general`, `explain`, `generate`, `security`, `debug`, `documentation`, `architecture`.

## Agents

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/agents/tasks` | Tasks in the caller's organization. |
| POST | `/agents/tasks` | `objective` (min 10), optional `projectId`, `autoApprove`. |
| GET | `/agents/tasks/:id` | Task detail. |
| GET | `/agents/tasks/:id/events` | Persisted event stream. |
| POST | `/agents/tasks/:id/approve` | `stepId`, `approved`, optional `note`. |
| POST | `/agents/tasks/:id/cancel` | Sets the cancellation signal. |

## Security

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/security/scan` | `files: [{ path, content }]`, optional `projectId`. Returns severity summary and findings. |
| GET | `/security/scans` | Recent scans. |
| GET | `/security/owasp` | OWASP Top 10 educational catalog. |

Findings include `severity`, `category`, `title`, `description`, optional `filePath`/`line`, `remediation`, and redacted evidence.

## Developer tools

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/dev/code/review` | `files`, optional `title`/`projectId`; persists the review. |
| GET | `/dev/reviews` | Recent reviews. |
| POST | `/dev/testing/run` | `files`, `framework`, optional `command`; generates skeletons and records `status: skipped`. |
| GET | `/dev/testing/runs` | Recent runs. |
| POST | `/dev/debug/analyze` | `error`, optional `stackTrace`/`files`; returns frames, causes and fixes. |

## GitHub

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/github/connections` | Connected repositories for the organization. |
| GET | `/github/repos` | Repositories available to the supplied token. |
| POST | `/github/connect` | `owner`, `name`, optional `defaultBranch`. |
| GET | `/github/repos/:owner/:name/commits` | Genuine commit list. |
| GET | `/github/repos/:owner/:name/pulls` | Genuine pull request list. |
| POST | `/github/repos/:owner/:name/pulls/:number/review` | Defensive review plus optional AI summary. |
| GET | `/github/activity?owner=&name=` | Activity counters, issues and contributors. |

Send `X-GitHub-Token` for one-off requests, or configure `GITHUB_TOKEN` on the server.

## Analytics and WebSocket

- `GET /analytics/overview`: real counters derived from stored records.
- `GET /analytics/usage`: model usage records.
- `GET /ws?token=<access-token>`: event fanout filtered by organization.

Schemas in `packages/shared/src/schemas.ts` are the authoritative request contracts.
