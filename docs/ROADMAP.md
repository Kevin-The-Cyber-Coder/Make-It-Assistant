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
- Isolated sandbox worker with an approval-gated command allowlist and staged artifact manifests.
- Redis-backed rate limiting and task queues with in-process fallbacks when Redis is absent.
- Browser-based GitHub OAuth with signed state and an encrypted, HTTP-only token cookie.
- Token-level usage accounting for SSE streams with explicit estimated/provider-reported labels.
- Container images, Compose services and Kubernetes manifests for deployment templates.
- Optional live OSV advisory lookup layered over the offline dependency heuristics.
- Organization-scoped audit log query API and console viewer with filters, summaries, and JSON/CSV export.
- Organization-scoped global search API wired into the console command palette.
- Authenticated system status endpoint and Settings runtime diagnostics panel.
- Readiness endpoint (`/readyz`) with storage/Redis checks for deployment probes.
- Agent task metrics endpoint and Agent Console summary cards.
- Security scan metrics endpoint and Security Center telemetry cards.
- Testing run metrics endpoint and Testing Lab telemetry cards.
- Code review metrics endpoint and Review workspace telemetry cards.
- Project metrics endpoint and Projects workspace telemetry cards.
- Conversation metrics endpoint and AI Assistant telemetry cards.
- GitHub integration metrics endpoint and workspace telemetry cards.
- Agent queue visibility card in the Agent Console.
- Usage metrics endpoint and Analytics success-rate telemetry.
- Authenticated system version endpoint and Settings version display.
- Dashboard audit telemetry card and audit log shortcut.
- Dashboard runtime health card with system status summary.
- Authenticated system configuration summary endpoint and Settings panel.
- Conversation export endpoint and AI Assistant export action.
- Audit log filter suggestions from summary data.
- Security scan export endpoint and Security Center export action.
- Agent task export endpoint and Agent Console export action.
- Code review export endpoint and Review workspace export action.
- Test run export endpoint and Testing Lab export action.
- Project export endpoint and Projects workspace export action.
- Code review detail endpoint for organization-scoped review retrieval.
- Test run detail endpoint for organization-scoped test run retrieval.
- Conversation detail endpoint for organization-scoped conversation retrieval.
- Conversation title update endpoint with audit logging.
- GitHub repository connection delete endpoint with role and audit checks, and GitHub console disconnect action.
- Audit log detail endpoint for organization-scoped audit entry retrieval.
- GitHub repository connection detail endpoint for organization-scoped retrieval.
- AI metrics endpoint for organization-scoped conversation and message counts.
- Security scan delete endpoint with role and audit checks, and Security Center delete action.
- Code review delete endpoint with role and audit checks, and Review workspace delete action.
- Test run delete endpoint with role and audit checks, and Testing Lab delete action.
- Agent task delete endpoint with role and audit checks, and Agent Console delete action.
- Project conversations endpoint for organization-scoped project conversation retrieval.
- Project security scans endpoint for organization-scoped project scan retrieval.
- Project code reviews endpoint for organization-scoped project review retrieval.
- Project test runs endpoint for organization-scoped project test run retrieval.
- Project agent tasks endpoint for organization-scoped project task retrieval.
- Project summary endpoint for organization-scoped project resource counts.
- Security scan list project filter for organization-scoped scan queries.
- React engineering console with all feature workspaces.
- Vitest unit/integration tests, CI workflow and generated repository status report.

## Not yet implemented

- Independent security audit and load testing.

## Design decisions to revisit

- The workflow engine currently executes steps sequentially; parallel fan-out needs a scheduler and conflict policy.
- Generated artifacts are returned as data and stored in task results; no automatic write-to-disk path exists by design.
- JSON-file storage is intentionally simple and serializes collection writes with a short debounce; it is not suitable for multiple API processes.
- Provider base URLs are configurable to support compatible gateways, but adapter behavior follows each vendor's public REST shape.

## Verification status

Run `npm run compliance` for a generated report based on actual Git history and files. Run `npm run typecheck`, `npm test` and `npm run build` for executable validation. No result should be assumed until those commands succeed in the current checkout.
