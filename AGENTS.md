# Yosemite Crew Agent Guide

Auto-loaded by OpenAI Codex, Claude Code, and compatible AI agents. This is the **root** of a hierarchy — read the relevant per-app file before working in that workspace.

## Files Hierarchy

| File                         | Scope                                   |
| ---------------------------- | --------------------------------------- |
| `AGENTS.md` (this file)      | Monorepo-wide rules                     |
| `apps/frontend/AGENTS.md`    | Frontend: design system, Sonar, testing |
| `apps/backend/AGENTS.md`     | Backend: Express, validation, services  |
| `apps/mobileAppYC/AGENTS.md` | Mobile: React Native, Redux, navigation |
| `packages/AGENTS.md`         | Shared packages: types, fhirtypes       |

Claude Code users: same rules also structured as skills in `.claude/skills/`.

---

## Repository

- Tooling: `pnpm` workspaces + `turbo`. Package manager: `pnpm@8.15.6` — never use `npm` or `yarn`.
- Workspaces: `apps/frontend`, `apps/backend`, `apps/mobileAppYC`, `apps/dev-docs`, `packages/types`, `packages/fhirtypes`, `packages/fhir`.
- Architecture baseline (scale, domain model, platform directions): `.claude/skills/monorepo-ops/project-baseline.md`.

---

## Required Workflow

1. Make the smallest safe change for the request.
2. Keep code, tests, and docs in sync.
3. For any behavior or contract change, update/add targeted tests in the same batch.
4. Before every checkpoint, run and report lint + typecheck + targeted tests for each touched workspace.
5. When resuming interrupted work, inspect `git status` first — preserve all uncommitted changes unless the user explicitly says otherwise.
6. **NEVER run `git commit` yourself.** After every logical batch, tell the user: "**COMMIT CHECKPOINT** — suggested message: `<conventional commit message>`"
7. Never run the full test suite without `--testPathPattern` — takes 100+ seconds, forbidden.
8. Never commit secrets, tokens, private keys, or `.env` values.
9. Never add co-author lines or signatures to commit messages.
10. Let all pre-commit hooks pass naturally — `--no-verify` is forbidden.
11. **TypeScript check timeout:** `npx tsc --noemit` can take 60–120s on this repo. Set a 120s timeout. If it times out, tell the user explicitly — never silently skip it.
12. **Tests for touched files:** Before each COMMIT CHECKPOINT, check `src/app/__tests__/` for a matching test file. If one exists, run it and fix any failures. If you add a new component/hook/function, write tests (≥ 90% coverage) in the same batch. Report results — never fabricate or omit them.

---

## Commit Format

Conventional commits enforced by `commitlint`:

```
<type>(<scope>): <subject>
Types: feat | fix | chore | refactor | test | docs | style | perf | ci
Scopes: backend | frontend | mobile | dev-docs | types | fhirtypes | repo | ci | docs
```

For cross-workspace changes use `repo`. PR title must match the same pattern.

---

## Mandatory Checks Per Workspace

**Frontend (`apps/frontend`):**

```bash
npx tsc --noemit                    # from apps/frontend/
pnpm --filter frontend run lint
pnpm --filter frontend run test -- --testPathPattern="<YourFile>"
```

**Mobile (`apps/mobileAppYC`):**

```bash
npx tsc --noemit                    # from apps/mobileAppYC/
pnpm --filter mobileAppYC run lint
pnpm --filter mobileAppYC run test -- --testPathPattern="<YourFile>"
```

---

## New Code = New Tests (Mandatory)

Coverage bar for any new file: **Statements ≥ 90%, Branches ≥ 90%, Functions ≥ 90%.**

| What you add                | Required test                                        |
| --------------------------- | ---------------------------------------------------- |
| Service function / API call | Jest unit: success + all error branches              |
| Zustand store / Redux slice | Jest: every action, selector, edge case              |
| Custom hook                 | `renderHook` covering all return values and branches |
| Utility / lib function      | Jest unit with full branch coverage                  |
| UI component (frontend)     | RTL render + at least one interaction test           |
| Screen (mobile)             | Jest + Testing Library render test                   |
| E2E-critical flow           | Playwright (frontend) or Detox (mobile)              |

---

## Code Quality

- Prefer strict typing; avoid `any` unless unavoidable.
- Keep PRs focused and reversible.
- Never expose backend enums or acronyms in user-facing text (e.g. `PAYMENT_AT_CLINIC`, `VET`). Map to plain language before rendering.
- Do not use `Actor` as a UI label — prefer `Lead`, `Support`, or `Updated by`.
- For frontend Sonar compliance: `apps/frontend/AGENTS.md` and `.claude/skills/frontend-sonar/SKILL.md` are the source of truth.

---

## Issue + PR Drafting (Only On Explicit Request)

- Base SHA: `git merge-base HEAD upstream/dev`.
- Draft from actual file diffs, not commit titles.
- Group changed files by domain; include Merck explicitly if `apps/mobileAppYC/src/features/merck/` or backend Merck paths changed.
- Templates: `.github/ISSUE_TEMPLATE/feature_request.md` and `.github/PULL_REQUEST_TEMPLATE.md`.
- Output to `.tmp/agent-output/latest-issue-pr.md` (gitignored, ephemeral).

---

## Security

- Treat all credentials as sensitive and non-committable.
- Prefer secure defaults and explicit validation at boundaries.
- Do not fabricate command output, test results, or external facts.
