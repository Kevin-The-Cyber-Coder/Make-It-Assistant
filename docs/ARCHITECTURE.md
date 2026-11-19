# Architecture

## Runtime topology

```text
Browser (React/Vite)
  -> REST /api/v1 (Express)
  -> SSE /api/v1/ai/stream
  -> WebSocket /ws?token=...
       |
       +-- Auth, projects, conversations, agents, security, dev, GitHub, analytics modules
       +-- Shared repositories (memory | JSON file | MongoDB)
       +-- AIGateway -> provider adapters -> OpenAI / Anthropic / Gemini / local-rules
       +-- Orchestrator -> planner -> specialists -> workflow -> approvals -> events
       +-- EventBus -> WebSocket fanout filtered by organization
```

## Layering

1. **Presentation** (`apps/web`): feature pages, reusable UI primitives, typed API client and React Query cache.
2. **Transport** (`apps/api`): Express routers, validation middleware, auth, error mapping, rate limits and SSE/WebSocket handling.
3. **Domain packages**: gateway, agents, project intelligence, security engine, dev engine and GitHub integration. Each package exports through a single `src/index.ts`.
4. **Persistence** (`packages/database`): a common `Repository<T>` contract with three adapters. Handlers never import Mongo directly.
5. **Shared contract** (`packages/shared`): domain types, Zod schemas, errors and event names so client and server agree without duplicating definitions.

## AI request lifecycle

1. Zod validates `chatSchema`.
2. `AIGateway.prepare` applies the prompt manager, retrieves relevant project context, attaches it and fits messages to the token budget.
3. `ModelRouter` builds candidates from configured providers and task capabilities.
4. `FallbackManager` tries candidates in priority order, never sending content to unconfigured providers.
5. The adapter response is normalized, evaluated and reported through `onUsage`.
6. Chat responses are persisted as messages; stream responses emit `chunk`, `done` and `error` events.

## Agent lifecycle

1. `Orchestrator.start` creates a task and a deterministic plan from the objective.
2. `WorkflowEngine` executes steps sequentially and honours cancellation signals.
3. Steps marked `requiresApproval` pause with an `awaiting_approval` event until a human calls the approve endpoint.
4. Specialists combine model output with local deterministic engines; they return artifacts and findings without applying file changes.
5. Task state, plan and events are persisted and streamed to the UI.

## Storage selection

`connectDatabase` selects MongoDB when `MONGODB_URI` is present, JSON files when `DATA_DIR` is configured, and memory otherwise. API bootstrap passes the resulting handle into every module through `AppContext`, so switching adapters does not change route logic.

## Trust boundaries

- Repository content is input data. Prompt construction labels it as untrusted and never interprets it as instructions.
- Provider keys exist only in server environment variables.
- Tokens supplied through UI headers stay in React component state and are not persisted.
- Command execution is gated behind an executor interface that is not attached by default.
