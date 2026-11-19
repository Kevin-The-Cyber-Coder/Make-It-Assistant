# Isolated sandbox worker

The sandbox worker is an optional separate service at `apps/worker`. The API does not execute commands in-process.

## What it actually does

- Accepts only commands in an explicit allowlist (`SANDBOX_ALLOWED_COMMANDS`).
- Creates a temporary workspace, writes only the supplied project files into it, and deletes the workspace afterwards.
- Spawns the allowlisted command with `shell: false`, a short environment allowlist, an output byte cap and a timeout.
- Requires both an approval flag in the request and a matching `X-Sandbox-Token` when `SANDBOX_TOKEN` is configured.
- Returns an execution result. If no worker is configured, the API leaves command execution disabled and reports that no worker is attached.

The API only calls the executor after the agent workflow has obtained explicit human approval for the sensitive step. The worker's approval flag is a second gate, not proof of a separate UI review.

## What it does not do

- It does not run arbitrary shell strings.
- It does not apply generated file changes back into the repository. The `/stage` endpoint returns a manifest with hashes and `applied: false`.
- It does not inherit provider keys or repository credentials into the child process.
- It is not a hardened multi-tenant container boundary. Use a real container/VM isolation layer for untrusted code.

## Endpoints

- `GET /healthz` — service status and active allowlist.
- `POST /execute` — `{ command, files, approved, timeoutMs? }`.
- `POST /stage` — `{ artifacts: [{ path, content }] }` returns a staged manifest with `applied: false`.

## Local use

```bash
npm run dev:worker
```

Then set `SANDBOX_URL=http://localhost:4100` and, if used, `SANDBOX_TOKEN` in the API environment. Leave `SANDBOX_URL` empty to keep execution disabled.
