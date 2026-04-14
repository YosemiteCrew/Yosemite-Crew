# Claude Code Agent Instructions — Yosemite Crew

This file is auto-loaded by Claude Code on every session. All rules here are **mandatory**.

## Skills Index

Modular skills in `.claude/skills/` provide deep, app-specific guidance. Load the relevant one before starting any task:

| Skill                             | When to use                                                  |
| --------------------------------- | ------------------------------------------------------------ |
| `.claude/skills/frontend-design`  | UI work, new components, styling in apps/frontend            |
| `.claude/skills/frontend-sonar`   | SonarQube fixes or writing Sonar-clean code in apps/frontend |
| `.claude/skills/frontend-testing` | Writing/fixing/running tests in apps/frontend                |
| `.claude/skills/backend-patterns` | Any work in apps/backend                                     |
| `.claude/skills/mobile-patterns`  | Any work in apps/mobileAppYC                                 |
| `.claude/skills/monorepo-ops`     | Cross-app work, dependency changes, turbo, pnpm              |
| `.claude/skills/code-review`      | Reviewing code or auditing a PR                              |

Per-app `AGENTS.md` files (for Codex compatibility): `apps/frontend/AGENTS.md`, `apps/backend/AGENTS.md`, `apps/mobileAppYC/AGENTS.md`.

---

## Monorepo Layout

```
apps/
  frontend/      — Next.js web app (primary)
  backend/       — API server (do not refactor unless explicitly asked)
  mobileAppYC/   — React Native mobile app
  dev-docs/      — Internal documentation site
packages/
  types/         — Shared TypeScript types
  fhirtypes/     — FHIR type definitions
```

Tooling: `pnpm` workspaces + `turbo`. Always use `--filter` to scope commands to the relevant workspace.

---

## Mandatory Checks Before Finishing A Frontend Task

Run these in order when your changes touch `apps/frontend`. **Never skip any of them for frontend work.**

```bash
# 1. Type check (run from apps/frontend/ with a 120s timeout)
npx tsc --noemit

# 2. Lint
pnpm --filter frontend run lint

# 3. Tests — TARGETED ONLY, never the full suite
pnpm --filter frontend run test -- --testPathPattern="<relevant-file>"
# Example:
pnpm --filter frontend run test -- --testPathPattern="Availability"
```

**Full test suite runs are forbidden.** They take 100+ seconds. Always target the test file(s) related to what you changed.

**TypeScript check timeout:** `npx tsc --noemit` on this repo can take 60–120 seconds. Always set a 120s timeout when running it as a tool call. If it times out, note this explicitly to the user — do not silently skip it.

**Coverage mandate — non-negotiable:**

- Target: ≥ 95% Statements, Branches, Functions, Lines across `apps/frontend`.
- Any file you touch must finish with equal or higher coverage than you found it.
- Any file you create must hit ≥ 90% on first commit — no new file ships without tests.
- When you modify behaviour, update existing tests for the changed path AND add new cases for new branches.
- For every file you touch, check `src/app/__tests__/` (mirroring source path) for an existing test file. If one exists: run it, fix any failures your change introduced.
- Report actual test + coverage output at each COMMIT CHECKPOINT. Never skip or fabricate results.

For backend/mobile/shared-package only changes, run the workspace-appropriate checks instead of frontend checks.

## Commit Discipline — CRITICAL

Before making changes in a resumed or compacted session, run `git status --short` and preserve any existing uncommitted work unless the user explicitly asks you to discard it.

**NEVER run `git commit` yourself.** The agent must never commit. Instead:

- After every logical batch of changes (per file or feature), tell the user: "**COMMIT CHECKPOINT** — suggested message: `<conventional commit message>`"
- The user commits manually.
- This prevents context compaction from silently discarding uncommitted work.

Additional commit rules:

- Never add `Co-Authored-By` or any signature lines to commit messages.
- Never skip pre-commit hooks (`--no-verify` is forbidden).
- All pre-commit hooks must pass before the user commits — if lint/type/test checks fail, fix them first.
- Before suggesting any commit message, validate the scope against `commitlint.config.cjs`.
- Allowed scopes are exactly: `backend`, `frontend`, `mobile`, `dev-docs`, `types`, `fhirtypes`, `repo`, `ci`, `docs`.
- If changes span multiple workspaces, use `repo`.

Issue + PR draft workflow (only on explicit user request):

- Compute base SHA using `git merge-base HEAD upstream/dev`.
- Analyze commits and changed files from `<base>..HEAD`.
- Build draft content from actual file diffs; never infer scope from commit title alone.
- Group changed files by domain/workstream and ensure all material domains are reflected in Issue and PR body.
- If Merck paths changed (`apps/mobileAppYC/src/features/merck/` or backend Merck integration paths), explicitly include Merck integration updates.
- Use `.github/ISSUE_TEMPLATE/feature_request.md` and `.github/PULL_REQUEST_TEMPLATE.md` as the exact template source.
- Generate or overwrite a single latest file: `.tmp/agent-output/latest-issue-pr.md`.
- Do not auto-generate this file unless asked.
- Treat `.tmp/agent-output/` as temporary local output (gitignored, deletable anytime).

---

## Code Quality

All SonarQube rules, test writing rules, and frontend code quality patterns live in the skills — do not duplicate them here.

- **Sonar issues:** load `.claude/skills/frontend-sonar` — contains the complete enforced rule set.
- **Test patterns:** load `.claude/skills/frontend-testing` — covers Jest/RTL conventions, Zustand mocking, async state, common pitfalls.
- Violations introduced in any change must be fixed before the change is considered done.

---

## What NOT to Do

- Do not run `pnpm run test` without `--testPathPattern` — full suite is forbidden.
- Do not commit `.env` files, secrets, tokens, or private keys.
- Do not refactor backend code unless explicitly requested.
- Do not add `// eslint-disable` comments to suppress warnings — fix the root cause.
- Do not create new files when editing an existing one achieves the goal.
- Do not add docstrings, comments, or type annotations to code you didn't change.
- Do not add error handling for scenarios that cannot happen.
- Do not design for hypothetical future requirements.
- Do not fabricate command output, test results, or lint results.

---

## Commit & PR Format

Conventional commits are enforced by `commitlint`:

```
<type>(<scope>): <subject>

Types: feat | fix | chore | refactor | test | docs | style | perf | ci
Scope: backend | frontend | mobile | dev-docs | types | fhirtypes | repo | ci | docs

Examples:
  feat(frontend): add recurring appointment support
  feat(mobile): improve invoice linking for appointment details
  fix(frontend): resolve button nesting in Availability component
  fix(frontend): use HTMLElement drag handler type across board cards
  test(frontend): fix Availability icon mock to use span not button
  chore(repo): update agent rules with sonar patterns
```

PR title must match the same pattern. PR body must include: what changed, why, impact area, validation performed.

---

## Context Management (Token Hygiene)

- Run `/compact Focus on code changes and errors only` before switching tasks or files mid-session.
- Run `/clear` between completely unrelated tasks to reset context.
- Run `/cost` after the first message of a new session — if `cache_read_input_tokens` is 0, update Claude Code (`claude update`) to fix the prompt-cache bug.
- **Disk space:** Keep `/` above 2 GB free. Claude Code writes session state to `/tmp` — if disk is full, tool calls fail silently and burn extra tokens on retries. Check with `df -h /`.

## How to Give Me a Task Efficiently

Use this pattern when prompting:

```
[SCOPE: frontend | backend | mobile | types | all]
[FILES: optional list of files to focus on]

<your task description>
```

Example prompts that work well:

- `[SCOPE: frontend] Fix the nested ternary sonar issues in AppointmentCalendar.tsx`
- `[SCOPE: frontend] [FILES: TaskBoard.tsx] Add keyboard accessibility to the drag handles`
- `[SCOPE: frontend] Run targeted tests for the Availability component and fix any failures`
- `[SCOPE: frontend] Fix all issues in the latest sonar.md dump and update the tracker`

---

## Sonar Issue Tracker

The resolved/unresolved issue log lives at [`docs/guide/sonar-tracker.md`](docs/guide/sonar-tracker.md).
The raw sonar dump is at [`docs/guide/sonar.md`](docs/guide/sonar.md).
Update the tracker (`resolved` column) whenever you fix an issue from that list.
When a new sonar.md is provided, generate new tracker rows for all new issues and mark them as the fixes are applied.
