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

## Code Quality Rules

- Follow existing project patterns and naming.
- Prefer strict typing; avoid `any` unless unavoidable and documented.
- Keep PRs focused and reversible.
- Add or update tests for behavioral changes.
- Update docs when changing setup, architecture, scripts, or contributor workflows.

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
