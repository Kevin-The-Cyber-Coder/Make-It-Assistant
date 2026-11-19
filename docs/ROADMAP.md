# Roadmap and known gaps

## Delivered in this rebuild

- Monorepo conversion with the original Changesets action preserved under `tools/changesets-action`.
- Shared domain types and Zod validation schemas.
- Memory, JSON-file and MongoDB repository adapters.
- AI Gateway with OpenAI, Anthropic, Gemini and explicitly labeled offline fallback.
- Agent planner, specialists, workflow, approvals, cancellation and event persistence.
- Project scanning/context retrieval, defensive scanner, review/test/debug engines.
- GitHub REST integration and defensive PR review.
- Express API with auth, org scoping, SSE and authenticated WebSocket fanout.
- React engineering console with all feature workspaces.
- Vitest unit/integration tests, CI workflow and generated repository status report.

## Not yet implemented

- Redis-backed distributed rate limiting and task queues.
- Real isolated sandbox worker for executing generated tests or applying agent-produced file changes.
- Browser-based GitHub OAuth flow. Current integration uses a server token or a session-only user token.
- Live CVE ingestion for dependency auditing.
- Streaming token-level usage accounting for SSE responses; usage is recorded for chat and completed streams at a coarse level.
- Production deployment manifests (Kubernetes, Terraform or similar).
- Independent security audit and load testing.

## Design decisions to revisit

- The workflow engine currently executes steps sequentially; parallel fan-out needs a scheduler and conflict policy.
- Generated artifacts are returned as data and stored in task results; no automatic write-to-disk path exists by design.
- JSON-file storage is intentionally simple and serializes collection writes with a short debounce; it is not suitable for multiple API processes.
- Provider base URLs are configurable to support compatible gateways, but adapter behavior follows each vendor's public REST shape.

## Verification status

Run `npm run compliance` for a generated report based on actual Git history and files. Run `npm run typecheck`, `npm test` and `npm run build` for executable validation. No result should be assumed until those commands succeed in the current checkout.
