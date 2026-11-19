# Security posture

## Defensive scope

This platform is built for authorized engineering work. The security engine detects patterns in supplied source to help remediate weaknesses. It does not perform exploitation, generate payloads, or probe systems without authorization.

## Controls implemented

- **Authentication**: scrypt password hashing with random salts, JWT access tokens and rotating refresh tokens. Refresh tokens are hashed before storage.
- **Authorization**: organization identifiers are attached to tokens and enforced in repository queries and WebSocket subscriptions.
- **Validation**: all request bodies are parsed with Zod schemas before handler execution.
- **Transport**: security headers, CORS allowlist, rate limiting, request ids and error mapping that avoids leaking internals.
- **Secrets**: provider keys are read only from server environment variables. API responses expose configured booleans, never values.
- **Prompt safety**: indexed and supplied files are wrapped as untrusted data. The offline adapter is labeled to prevent confusion with model-backed analysis.
- **Approvals**: implementing steps in agent plans require explicit approval by default. Cancellation is signal-based and checked between steps.
- **Evidence redaction**: detected secrets are redacted before findings are persisted or returned.
- **Execution gating**: no arbitrary shell endpoint exists. Test generation returns skeletons and a `skipped` status until an isolated executor is attached.

## Known limitations

- The SAST and secret rules are heuristic and can produce false positives or miss context-dependent issues.
- Dependency checks use a small local advisory set, not a live CVE database.
- The in-memory and JSON-file repositories are for local development; use MongoDB for multi-process deployments.
- Redis is not yet used for distributed rate limits or task queues.
- No independent security audit has been performed. Do not treat this repository as certified.

## Reporting a vulnerability

Open a private security advisory on the GitHub repository rather than publishing exploit details in a public issue. Include reproduction steps, affected component and impact. Do not include real credentials in reports.
