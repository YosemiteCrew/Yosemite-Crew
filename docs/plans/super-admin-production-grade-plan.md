# Super Admin Implementation Plan (Industry-Standard, Production-Grade, OSS-First, Zero-Error CI)

## Summary

Build a new `apps/super-admin` (React + open-source stack) with strict multi-tenant governance:

1. Platform super-admin can manage all customer tenants.
2. Tenant operational financials are hidden by default.
3. Access to sensitive tenant data only via audited, time-limited break-glass.
4. Engineering quality gate is strict: no `tsc`, lint, test, or Sonar failures allowed to merge.
5. Authentication is AWS Cognito with mandatory MFA for all super-admin users.

## Open-Source Stack (Final)

1. Admin UI: `react-admin` (OSS, mature, long-lived ecosystem).
2. API/backend: existing `apps/backend` (Express + Mongoose), add `/v1/super-admin/*`.
3. Analytics: self-hosted `Metabase` embed + API-served KPI tiles.
4. Developer portal future: `Backstage` control plane + existing `apps/dev-docs` docs site.
5. CI quality: ESLint + TypeScript + Jest + SonarQube quality gate (block merge on fail).

## API / Interface Additions

1. `GET /v1/super-admin/auth/config` (Cognito pool/client metadata, MFA policy state)
2. `GET /v1/super-admin/leads`
3. `PATCH /v1/super-admin/leads/:id/status`
4. `PATCH /v1/super-admin/leads/:id/assignee`
5. `GET /v1/super-admin/businesses`
6. `GET /v1/super-admin/businesses/:id`
7. `PATCH /v1/super-admin/businesses/:id/status` (`approved | suspended | deactivated`)
8. `GET /v1/super-admin/businesses?status=invited` (invited by pet parents)
9. `GET /v1/super-admin/support/tickets`
10. `PATCH /v1/super-admin/support/tickets/:id/status`
11. `PATCH /v1/super-admin/support/tickets/:id/priority`
12. `PATCH /v1/super-admin/support/tickets/:id/assignee`
13. `GET /v1/super-admin/team-members`
14. `POST /v1/super-admin/team-members`
15. `DELETE /v1/super-admin/team-members/:id`
16. `GET /v1/super-admin/users` (unified mobile/web/developer identities)
17. `GET /v1/super-admin/analytics/app-users-total` (Cognito + Firebase aggregate)
18. `GET /v1/super-admin/analytics/pms-users-total`
19. `POST /v1/super-admin/break-glass/grants`
20. `POST /v1/super-admin/break-glass/revoke/:grantId`
21. `GET /v1/super-admin/developers`
22. `GET /v1/super-admin/developer-apps`

## Security and Governance Rules

1. Deny-by-default permission model.
2. Field-level response allowlist for tenant-sensitive data.
3. Break-glass requires `reason + ticketId + expiry + approver`.
4. Immutable audit events for all sensitive reads/actions.
5. All super-admin routes behind dedicated permissions (`superadmin:*`).
6. AWS Cognito is the identity provider for super-admin, with MFA required for every super-admin sign-in.

## Implementation Steps (Execution-Ready)

1. Create `apps/super-admin` with `react-admin` resources:
   - leads, businesses, support tickets, team members, users, analytics, developers, audit.
2. Add backend super-admin router/controllers/services in `apps/backend/src`.
3. Implement Cognito super-admin auth integration with enforced MFA policy checks.
4. Implement leads management:
   - list leads, update status, assign to team members.
5. Implement business management:
   - list businesses, view details, approve/suspend/deactivate, filter invited businesses.
6. Implement support management:
   - list/manage tickets, assign owner, update status and priority.
7. Implement team management:
   - create and remove team members with role-bound permissions.
8. Implement unified user read model:
   - merge `AuthUser` (mobile firebase/cognito), PMS users, future dev users.
9. Implement analytics aggregations:
   - total app users from Cognito + Firebase,
   - total PMS users.
10. Add break-glass grant lifecycle + policy middleware + audit logging.
11. Deploy and embed Metabase dashboards for analytics-heavy pages.
12. Add developer ecosystem surfaces for future Backstage integration.
13. Harden observability: authz failures, MFA failures, access anomalies, audit exports.

## Test Plan (Must Pass)

1. Unit tests:
   - policy middleware, serializers, MFA policy enforcement, break-glass TTL/expiry, app/PMS user aggregations.
2. Integration tests:
   - each `/v1/super-admin/*` endpoint authz + data contract.
3. Security tests:
   - forbidden role access, MFA required path coverage, tenant financial field leakage checks.
4. Regression tests:
   - existing PMS/mobile endpoints unaffected.
5. UI tests:
   - leads, businesses, support, team, and analytics pages render and enforce permission guards.

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

1. Super-admin sign-in is AWS Cognito based and MFA is mandatory for all super-admin users.
2. Super-admin can view/manage all leads, update lead status, and assign leads to team members.
3. Super-admin can view all businesses, view business details, approve/suspend/deactivate businesses, and filter `Invited` businesses (invited by pet parents).
4. Super-admin can manage support tickets, assign tickets to support members, and update ticket status/priority.
5. Super-admin can create and remove team members.
6. Analytics surfaces show:
   - total app users (Cognito + Firebase),
   - total PMS users.
7. Super-admin cannot see tenant internal financials by default.
8. Break-glass grants are required, time-bound, and fully audited.
9. `lint`, `tsc`, tests, and Sonar all pass with zero blocking issues.

## Assumptions / Defaults

1. Super-admin authentication is AWS Cognito with MFA required (no fallback local auth).
2. Mobile user auth remains mixed (Firebase + Cognito) with no migration now.
3. Self-hosting remains default for admin + analytics + developer infrastructure.
4. Backstage adoption is phased; no immediate replacement of existing docs site.
