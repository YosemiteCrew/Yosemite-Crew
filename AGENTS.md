# Yosemite Crew Agent Guide

This file defines how AI agents and automation should contribute to this repository.

## Scope

- Applies to the whole monorepo unless a deeper `AGENTS.md` overrides specific paths.
- Backend architecture decisions remain owned by backend maintainers; agents should avoid backend refactors unless requested.

## Repository Context

- Monorepo tooling: `pnpm` workspaces + `turbo`.
- Primary workspaces:
  - `apps/frontend`
  - `apps/mobileAppYC`
  - `apps/dev-docs`
  - `packages/types`
  - `packages/fhirtypes`

## Required Workflow

1. Make the smallest safe change for the request.
2. Keep code, tests, and docs in sync.
3. **Commit frequently** — after every logical batch of changes (per file or feature), run checks and commit immediately. Do NOT batch all changes and commit at the end. Context compaction will lose uncommitted work.
4. Run relevant checks before each commit:
   - `pnpm --filter frontend run lint`
   - `npx tsc --noemit` (from `apps/frontend/`)
   - Targeted tests only: `pnpm --filter frontend run test -- --testPathPattern="<relevant-file>"`
   - **Never run the full test suite** (`pnpm run test` without `--testPathPattern`) — it takes 100+ seconds and is forbidden.
5. Never commit secrets, tokens, private keys, or `.env` values.
6. Never add co-author lines or signatures to commit messages.
7. Let all pre-commit hooks pass naturally — never use `--no-verify`.

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
