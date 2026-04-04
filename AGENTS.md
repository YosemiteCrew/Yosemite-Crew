# Yosemite Crew Agent Guide

This file is auto-loaded by OpenAI Codex, Claude Code, and compatible AI agents.
It is the **root** of a skills/rules hierarchy — each app has its own `AGENTS.md` with deeper, app-specific rules. Always read the relevant per-app file before working in that workspace.

## Skills Hierarchy

| File                         | Scope                                                |
| ---------------------------- | ---------------------------------------------------- |
| `AGENTS.md` (this file)      | Monorepo-wide rules — apply everywhere               |
| `apps/frontend/AGENTS.md`    | Frontend-only: design system, Sonar, testing         |
| `apps/backend/AGENTS.md`     | Backend-only: Express patterns, validation, services |
| `apps/mobileAppYC/AGENTS.md` | Mobile-only: React Native, Redux, navigation         |
| `packages/AGENTS.md`         | Shared packages: types, fhirtypes                    |

For **Claude Code** users: modular skills are also in `.claude/skills/` — they are the same rules, structured for the Claude skills system.

## Scope

- Applies to the whole monorepo unless a deeper `AGENTS.md` overrides specific paths.
- Backend architecture decisions remain owned by backend maintainers; agents should avoid backend refactors unless requested.

## Repository Context

- Monorepo tooling: `pnpm` workspaces + `turbo`.
- Package manager: `pnpm@8.15.6` — never use `npm` or `yarn`.
- Primary workspaces:
  - `apps/frontend`
  - `apps/backend`
  - `apps/mobileAppYC`
  - `apps/dev-docs`
  - `packages/types`
  - `packages/fhirtypes`
  - `packages/fhir`

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

## Required Workflow

1. Make the smallest safe change for the request.
2. Keep code, tests, and docs in sync.
3. For any behavior or contract change, update/add targeted tests in the same batch. Do not leave failing tests caused by your code changes.
4. Before every checkpoint/handoff, run and report lint + typecheck + targeted tests for each touched app/workspace.
5. When resuming interrupted work, inspect `git status` first and preserve all existing uncommitted changes unless the user explicitly asks otherwise.
6. **NEVER commit code yourself.** The agent must never run `git commit`. Instead, after every logical batch of changes, tell the user: "**COMMIT CHECKPOINT** — suggested message: `<conventional commit message>`". The user commits manually.
7. Run relevant checks and report results before each commit checkpoint:
   - `pnpm --filter frontend run lint`
   - `npx tsc --noemit` (from `apps/frontend/`)
   - Targeted tests only: `pnpm --filter frontend run test -- --testPathPattern="<relevant-file>"`
   - **Never run the full test suite** (`pnpm run test` without `--testPathPattern`) — it takes 100+ seconds and is forbidden.
8. Never commit secrets, tokens, private keys, or `.env` values.
9. Never add co-author lines or signatures to commit messages.
10. Let all pre-commit hooks pass naturally — never use `--no-verify`.
11. Before suggesting any commit message, validate scope against `commitlint.config.cjs`.
    - Allowed scopes: `backend`, `frontend`, `mobile`, `dev-docs`, `types`, `fhirtypes`, `repo`, `ci`, `docs`.
    - For cross-workspace changes, default to `repo`.
12. Issue + PR drafting is on-demand only (only when explicitly requested by the user). For this flow:
    - Determine change range from last PR base as `git merge-base HEAD upstream/dev` to `HEAD`.
    - Analyze commits and changed files in that range.
    - Draft content from actual diff/file changes, not from commit title alone.
    - Group changed files by domain/workstream (for example: companion history, invoices, app updates, Merck, localization, config, docs) and ensure every materially changed domain is represented in Issue + PR text.
    - If `apps/mobileAppYC/src/features/merck/` or `apps/backend/src/integrations/merck/` changed, Merck integration must be explicitly called out in both Issue and PR sections.
    - Use `.github/ISSUE_TEMPLATE/feature_request.md` and `.github/PULL_REQUEST_TEMPLATE.md` as canonical templates; keep section headers/order unchanged.
    - Generate/update a single latest draft file at `.tmp/agent-output/latest-issue-pr.md`.
    - Keep `.tmp/agent-output/` gitignored and ephemeral (safe to delete anytime).

## Test Coverage — Mandatory For New Code

**Any new module, feature, service, hook, store slice, or utility added to `apps/frontend` or `apps/mobileAppYC` MUST ship with tests in the same batch. No exceptions.**

### What counts as "new code that needs tests"

| What you add                                        | What you must also add                                    |
| --------------------------------------------------- | --------------------------------------------------------- |
| New service function / API call                     | Jest unit test covering success + error branches          |
| New Zustand store (frontend) / Redux slice (mobile) | Jest tests for every action, selector, and edge case      |
| New hook                                            | `renderHook` test covering all return values and branches |
| New utility / lib function                          | Jest unit tests with full branch coverage                 |
| New UI component (frontend)                         | RTL render test + at least one interaction test           |
| New screen (mobile)                                 | Jest + Testing Library render test                        |
| New E2E-critical flow (auth, checkout, booking)     | Playwright test (frontend) or Detox test (mobile)         |

### Coverage bar

- **Statements ≥ 90%**, **Branches ≥ 90%**, **Functions ≥ 90%** for any new file you author.
- If your change touches an existing file that is below 90%, do not make it worse — add tests to hold or improve the current level.

### Mandatory checks before every commit checkpoint

**Frontend (`apps/frontend`):**

```bash
npx tsc --noemit                                              # from apps/frontend/
pnpm --filter frontend run lint
pnpm --filter frontend run test -- --testPathPattern="<YourFile>"
```

**Mobile (`apps/mobileAppYC`):**

```bash
npx tsc --noemit                                              # from apps/mobileAppYC/
pnpm --filter mobileAppYC run lint
pnpm --filter mobileAppYC run test -- --testPathPattern="<YourFile>"
```

**Never run the full suite without `--testPathPattern`.** Full suite takes 100+ seconds and is forbidden.

---

## Code Quality Rules

- Follow existing project patterns and naming.
- Prefer strict typing; avoid `any` unless unavoidable and documented.
- Keep PRs focused and reversible.
- Add or update tests for behavioral changes.
- Update docs when changing setup, architecture, scripts, or contributor workflows.
- For frontend Sonar compliance details, treat `apps/frontend/AGENTS.md` and `.claude/skills/frontend-sonar/SKILL.md` as the source of truth (including accessibility semantics, complexity caps, modern JS replacements, and regex/`replaceAll` constraints).

## UI Copy Standards (All Apps)

- Never expose backend enums, acronyms, or short forms directly in user-facing text (example: `PAYMENT_AT_CLINIC`, `VET`, `PMS`).
- Always map technical values to plain language labels before rendering.
- Do not use `Actor` as a UI label for people; prefer context labels like `Lead`, `Support`, or neutral `Updated by` when role-specific labels are not available.

### Frontend Test Pitfalls (apply when writing/fixing tests in `apps/frontend`)

- **No `require()` inside test bodies** — ESLint forbids it (`@typescript-eslint/no-require-imports`). Use top-level ES imports and cast: `(myFn as jest.Mock).mockImplementationOnce(...)`.
- **`jest.resetAllMocks()` clears factory mock values** — re-seed all `.mockReturnValue()` calls inside `beforeEach` after calling `resetAllMocks()`.
- **`axios.isAxiosError` requires `jest.mock("axios", ...)`** — `jest.spyOn` does not work reliably; cast as `(axios.isAxiosError as unknown as jest.Mock)`.
- **Read-only DOM props** (`scrollTop`, `scrollLeft`, etc.) — use `Object.defineProperty(el, prop, { value, writable: true, configurable: true })`.
- **Type cast errors** — when TypeScript complains about overlapping types, insert `unknown` as the bridge: `expr as unknown as TargetType`.
- **`Task._id` not `.id`** — the `Task` type uses `_id`; use `_id` in all task test fixtures.
- **`RoleCode` only covers `'OWNER'` and `'ADMIN'`** — cast other strings as `any` in test files.
- **`performAppointmentAction('accept')` needs a non-empty `lead.id`** — include `lead: { id: 'vet-1', name: 'Dr Vet' }` in fixtures for accept/checkin flows.
- **Pre-push type-check runs full `turbo type-check`** — all test files must pass `tsc --noEmit`, not just lint.

## Security And Compliance

- Treat all credentials as sensitive and non-committable.
- Prefer secure defaults and explicit validation at boundaries.
- Report vulnerabilities through `SECURITY.md` process, not public issues.

## AI Contribution Conduct

- Be explicit about assumptions and unknowns.
- Do not fabricate command output, test results, or external facts.
- Call out residual risk if checks were not run.
- If repository state is inconsistent, surface it clearly before broad edits.

## Commit And PR Expectations

- Conventional commits are required (`commitlint` + PR governance enforce this).
- PR title must follow `<type>(<scope>): <subject>`.
- Include what changed, why, impact area, and validation performed.
- Scope must be one of: `backend`, `frontend`, `mobile`, `dev-docs`, `types`, `fhirtypes`, `repo`, `ci`, `docs`.
