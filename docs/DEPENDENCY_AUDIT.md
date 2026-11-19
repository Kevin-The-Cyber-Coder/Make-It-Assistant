# Dependency auditing

Dependency checks have two layers. Both are informational and do not replace a lockfile-aware ecosystem audit.

## Offline layer (always on)

`auditDependencies` reads supported manifests through the project-intelligence analyzer and compares a small, explicit advisory list against version thresholds. Findings are labeled as heuristics and point to `npm audit` or the ecosystem-native tool. `POST /api/v1/security/scan` uses only this layer.

## Live OSV layer (opt-in)

Set `OSV_ENABLED=true` and call `POST /api/v1/security/scan/live`. The security engine sends a single batch request to `https://api.osv.dev/v1/querybatch` with `{ package: { name, ecosystem }, version }` entries and converts returned advisories into `dependency-vulnerability` findings with OSV links and aliases.

| Variable | Default | Meaning |
| --- | --- | --- |
| `OSV_ENABLED` | `false` | Enables the network lookup. |
| `OSV_API_URL` | `https://api.osv.dev` | Base URL; `/v1/querybatch` is appended. |
| `OSV_TIMEOUT_MS` | `8000` | Per-request timeout. |
| `OSV_MAX_PACKAGES` | `100` | Maximum packages in one batch. |

The response includes an `advisory` summary: queried package count, success flag, timestamp and error string when the lookup failed. A failed lookup does not fail the scan — offline findings are still returned, and the web console shows the reason.

## Limits

- Manifest version ranges are reduced to the first numeric version found (`^2.8.5` becomes `2.8.5`). Lockfiles are not read, so the queried version may differ from the actually installed version.
- The analyzer merges dependencies from all detected manifests. The OSV ecosystem is taken from the first manifest type found, which is wrong for mixed-ecosystem repositories.
- OSV severity mapping uses `database_specific.severity` when present and otherwise reports `medium`. CVSS vectors are not scored numerically.
- No credentials are sent to OSV. No data is cached. Quotas and availability are those of the public service.
- This is not a software bill of materials, a reachability analysis, or a compliance certification.
