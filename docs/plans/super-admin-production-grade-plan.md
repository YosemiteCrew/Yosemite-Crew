# Super Admin Implementation Plan (Industry-Standard, Production-Grade, OSS-First, Zero-Error CI)

## Summary
Build a new `apps/super-admin` (React + open-source stack) with strict multi-tenant governance:
1. Platform super-admin can manage all customer tenants.
2. Tenant operational financials are hidden by default.
3. Access to sensitive tenant data only via audited, time-limited break-glass.
4. Engineering quality gate is strict: no `tsc`, lint, test, or Sonar failures allowed to merge.

## Open-Source Stack (Final)
1. Admin UI: `react-admin` (OSS, mature, long-lived ecosystem).
2. API/backend: existing `apps/backend` (Express + Mongoose), add `/v1/super-admin/*`.
3. Analytics: self-hosted `Metabase` embed + API-served KPI tiles.
4. Developer portal future: `Backstage` control plane + existing `apps/dev-docs` docs site.
5. CI quality: ESLint + TypeScript + Jest + SonarQube quality gate (block merge on fail).

## API / Interface Additions
1. `GET /v1/super-admin/customers`
2. `GET /v1/super-admin/users` (unified mobile/web/developer identities)
3. `GET /v1/super-admin/contacts`
4. `PATCH /v1/super-admin/contacts/:id/status`
5. `GET /v1/super-admin/onboarding/doc-verifications`
6. `GET /v1/super-admin/platform-billing/overview` (platform-level only)
7. `GET /v1/super-admin/customers/:id/billing` (allowlisted fields only)
8. `POST /v1/super-admin/break-glass/grants`
9. `POST /v1/super-admin/break-glass/revoke/:grantId`
10. `GET /v1/super-admin/metrics/dau`
11. `GET /v1/super-admin/metrics/mau`
12. `GET /v1/super-admin/developers`
13. `GET /v1/super-admin/developer-apps`

## Security and Governance Rules
1. Deny-by-default permission model.
2. Field-level response allowlist for tenant-sensitive data.
3. Break-glass requires `reason + ticketId + expiry + approver`.
4. Immutable audit events for all sensitive reads/actions.
5. All super-admin routes behind dedicated permissions (`superadmin:*`).

## Implementation Steps (Execution-Ready)
1. Create `apps/super-admin` with `react-admin` resources:
   - customers, users, contacts, verification, billing, analytics, developers, audit.
2. Add backend super-admin router/controllers/services in `apps/backend/src`.
3. Implement unified user read model:
   - merge `AuthUser` (mobile firebase/cognito), PMS users, future dev users.
4. Implement customer overview + onboarding verification queue aggregations.
5. Implement platform billing endpoints with strict field allowlist.
6. Add DAU/MAU activity model (`UserActivityDaily`) and ingestion hooks.
7. Add break-glass grant lifecycle + policy middleware + audit logging.
8. Deploy and embed Metabase dashboards for analytics-heavy pages.
9. Add developer ecosystem surfaces for future Backstage integration.
10. Harden observability: authz failures, access anomalies, audit exports.

## Test Plan (Must Pass)
1. Unit tests:
   - policy middleware, serializers, break-glass TTL/expiry, DAU/MAU counters.
2. Integration tests:
   - each `/v1/super-admin/*` endpoint authz + data contract.
3. Security tests:
   - forbidden role access, tenant financial field leakage checks.
4. Regression tests:
   - existing PMS/mobile endpoints unaffected.
5. UI tests:
   - critical super-admin pages render and enforce permission guards.

## CI / Quality Gates (No Errors Policy)
1. Required checks (blocking):
   - `pnpm turbo run lint`
   - `pnpm turbo run type-check`
   - `pnpm turbo run test`
   - SonarQube Quality Gate = pass
2. PR is mergeable only if all required checks are green.
3. Enforce branch protection:
   - no admin override merges on red checks.
4. Add coverage threshold for changed files (e.g., 80% min) to prevent untested critical logic.

## Sonar Standards
1. Quality gate must fail on:
   - new critical/blocker bugs
   - new security hotspots unresolved
   - duplicated code above threshold
   - coverage below configured threshold on new code
2. Configure scanner in monorepo CI to include:
   - `apps/backend/src`
   - `apps/super-admin/src`
   - exclude build artifacts and generated files.

## Acceptance Criteria
1. Super-admin can list all customer tenants and unified users.
2. Super-admin cannot see tenant internal financials by default.
3. Break-glass grants are required, time-bound, and fully audited.
4. DAU/MAU, onboarding queue, contacts, and platform billing dashboards work.
5. `lint`, `tsc`, tests, and Sonar all pass with zero blocking issues.

## Assumptions / Defaults
1. Super-admin authentication remains Cognito-based.
2. Mobile user auth remains mixed (Firebase + Cognito) with no migration now.
3. Self-hosting remains default for admin + analytics + developer infrastructure.
4. Backstage adoption is phased; no immediate replacement of existing docs site.
