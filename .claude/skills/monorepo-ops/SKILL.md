# Monorepo Operations — Yosemite Crew

## Description

Use this skill for any task involving monorepo-level operations: running scripts, adding dependencies, managing shared packages, understanding workspace relationships, or cross-app work.

TRIGGER: tasks spanning multiple apps, dependency changes, turbo commands, pnpm workspace operations, or shared package changes.

---

## Workspace Layout

```
apps/
  frontend/       @yosemite-crew/frontend
  backend/        @yosemite-crew/backend
  mobileAppYC/    @yosemite-crew/mobile
  dev-docs/       @yosemite-crew/dev-docs
packages/
  types/          @yosemite-crew/types
  fhirtypes/      @yosemite-crew/fhirtypes
  fhir/           @yosemite-crew/fhir
```

Tooling: **pnpm workspaces** + **Turbo**. Package manager: `pnpm@8.15.6`.

---

## Project Analysis Baseline (March 31, 2026)

Use this baseline when drafting architecture decisions, technical narratives, or product-engineering updates.

### Monorepo shape and scale

- Workspace model: `pnpm` + `turbo`.
- Core apps: `apps/frontend` (staff-facing web PIMS), `apps/backend` (Express API), `apps/mobileAppYC` (pet-parent React Native app), `apps/dev-docs`.
- Shared packages: `@yosemite-crew/types`, `@yosemite-crew/fhirtypes`, `@yosemite-crew/fhir`, `@yosemite-crew/design-tokens`.
- Approx codebase surface (source files): frontend ~1132 TS/JS files, mobile ~501, backend ~254, packages ~115.
- Test footprint is large and distributed: frontend ~482 test files, mobile ~371 test files (targeted tests required).

### Product architecture (high-level)

- The platform is explicitly dual-surface:
  - Web PIMS for clinic operations (appointments, tasks, inventory, billing, forms, teams, integrations).
  - Mobile app for pet parents and co-parents (appointments, documents, tasks, expenses, emergency, linked businesses).
- Backend routes are split between FHIR-oriented resources (`/fhir/v1/*`) and app/mobile workflows (`/v1/*`), preserving interoperability while supporting product-specific flows.
- Shared domain contracts in `@yosemite-crew/types` are consumed across all apps, reducing contract drift between web, mobile, and backend.

### Domain model and interoperability strategy

- FHIR is treated as a boundary language, not the internal runtime model.
- Internal TypeScript domain objects are mapped to/from FHIR DTOs (e.g., appointments, forms, parent/companion entities), allowing cleaner product logic while keeping integration compatibility.
- Appointment flow and payloads are modeled in shared types and converted to FHIR at boundaries.

### Permissions and multi-actor access model

- Web app uses granular RBAC strings (`appointments:*`, `billing:*`, `forms:*`, `integrations:*`, etc.) and route-level permission gates.
- Mobile app uses companion-scoped co-parent permissions (`appointments`, `documents`, `expenses`, `tasks`, `chatWithVet`, emergency flags), with primary-parent override behavior.
- Backend enforces parent-companion role/permission lifecycle (`PRIMARY` vs `CO_PARENT`, promote/demote flows, permission patch APIs).
- Core architectural pattern: backend enforces authorization; clients derive deterministic UI affordances from permission payloads.

### Workflow chain encoded in the system

- Scheduling and clinical workflows: appointment services + availability + form attachments + check-in/status progression.
- Financial workflows: invoice and Stripe services tied to appointments and payment state.
- Follow-through workflows: tasks, reminders/recurrence engine, notifications, documents, audit trail.
- Integrations are first-class: labs (IDEXX), Merck, communication/chat, device token and notification infrastructure.

### Frontend platform direction

- Frontend is moving toward a stronger design system contract (`src/app/ui`) with Storybook and docs integration.
- Shared semantic token package (`packages/design-tokens`) is being established for cross-platform consistency.
- Strategy is semantic convergence across web/mobile, not forced shared component implementation.

### Mobile platform direction

- Feature-first module layout with Redux Toolkit + Redux Persist, typed navigation, and service-layer API access.
- The app supports production parent-facing flows (appointments, co-parent management, forms/doc signing, tasks, expenses, linked clinics).
- Mobile theme layer now includes semantic token mapping, enabling alignment with web token vocabulary while preserving RN-specific rendering behavior.

### Backend platform direction

- Express app with rate limiting, CORS controls, upload handling, sanitization, and centralized route registration.
- Service layer is extensive and domain-partitioned (appointments, forms, billing, integrations, labs, co-parent, tasks).
- Data transition path exists (Mongo + Prisma dual-write/read-switch patterns), indicating active persistence modernization.

### Practical framing for engineering narratives

When discussing Yosemite Crew publicly, ground claims in these repeatable technical themes:

1. Operational truth over UI illusion (state machines, permission-derived UX, deterministic flows).
2. Boundary-first interoperability (FHIR at edges, typed domain core).
3. Multi-actor authorization as product architecture (staff RBAC + companion-scoped co-parent controls).
4. Cross-surface consistency through shared contracts/tokens, not brittle code sharing.
5. End-to-end workflow ownership (schedule → care execution → billing → history/audit).

## Running Commands

Always use `--filter` to scope to the relevant workspace. Never run commands at root without `--filter` unless intentionally affecting all packages.

```bash
# Dev
pnpm --filter frontend dev
pnpm --filter backend dev

# Build
pnpm --filter frontend build
pnpm turbo build --filter=frontend...   # build frontend + its deps

# Lint
pnpm --filter frontend run lint
pnpm --filter backend run lint

# Type check
pnpm --filter frontend run type-check
# or from within the app:
npx tsc --noemit

# Tests (targeted)
pnpm --filter frontend run test -- --testPathPattern="ComponentName"
pnpm --filter mobile run test -- --testPathPattern="ScreenName"
```

---

## Adding Dependencies

```bash
# Add to a specific app
pnpm --filter frontend add <package>
pnpm --filter backend add <package>
pnpm --filter mobile add <package>

# Add as devDependency
pnpm --filter frontend add -D <package>

# Add to a shared package
pnpm --filter @yosemite-crew/types add <package>

# Add root devDependency (tooling only)
pnpm add -D -w <package>
```

---

## Shared Packages

When changing `packages/types` or `packages/fhirtypes`:

1. Update the type definitions.
2. Run `pnpm --filter @yosemite-crew/types build` (if it has a build step).
3. All consumers (frontend, backend, mobile) pick up changes automatically via workspace links.
4. Run type-check in each affected app.

---

## Build Pipeline (Turbo)

`turbo.json` defines the task graph. Tasks run in dependency order automatically.

```bash
pnpm turbo build           # builds all apps in correct order
pnpm turbo build --filter=frontend...  # builds frontend + its dependencies
```

---

## Pre-commit Hooks

Husky + commitlint are configured. Pre-commit runs lint + type-check. Commit messages must follow conventional commits:

```
<type>(<scope>): <subject>
Types: feat | fix | chore | refactor | test | docs | style | perf | ci
```

Scope allowlist is defined centrally in root `AGENTS.md` and enforced by `commitlint.config.cjs`.

Never skip hooks with `--no-verify`.

---

## Secrets Check

`secretlint` runs on commit. Never commit `.env` files, API keys, tokens, or private keys.

```bash
pnpm run check:secrets   # manual check
```

---

## Gotchas

- `pnpm install` at the root installs all workspaces. Never run `npm install` or `yarn` — pnpm only.
- Hoisting: some packages are hoisted to root `node_modules`, others are not. If you see resolution errors, check `pnpm-workspace.yaml`.
- Lock file: always commit `pnpm-lock.yaml` changes. Never ignore it.
- If turbo cache causes stale output: `pnpm turbo build --force` to bypass cache.
