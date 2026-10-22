# Dependency security audit — 22 October 2026

Repository: `lurnake/recipe-glance-open-source`. Changes are prepared on `security/dependency-audit-2026-10-22`.

Node runtime pins use the 21 October security releases: 22.23.4, 24.22.1, or 26.12.1. Deployments and existing developer checkouts have not been updated.

## Dependency scans

| Lock root | Critical | High | Moderate | Low |
|---|---:|---:|---:|---:|
| . (pnpm) | 0 | 0 | 0 | 0 |

## Verification

- PASS `node pnpm install --ignore-scripts --no-frozen-lockfile` (.).
- PASS `node pnpm audit --json` (.).
- PASS `node pnpm build` (.).
- PASS `node pnpm test` (.).
- PASS `node pnpm typecheck` (.).

A failed check is not classified as pre-existing without a baseline comparison. Service credentials were not copied from existing checkouts. Integration tests requiring external accounts or production writes were not run.

## Review and rollout

This is a draft patch. Resolve the failed checks and remaining advisories before treating the repository as fully remediated. Merge and redeploy separately, then verify the actual Node version in each hosting environment. Package pins do not update a running server.

Node advisory: https://nodejs.org/en/blog/vulnerability/october-2026-security-releases
