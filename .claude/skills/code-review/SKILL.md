# Code Review — Yosemite Crew

## Description

Use this skill when reviewing code, checking a PR, or performing an adversarial review of changes. Runs through quality, security, accessibility, and convention checks specific to this codebase.

TRIGGER: when asked to review code, check a PR, or audit changes in any part of this monorepo.

---

## Review Checklist

### Universal (all apps)

- [ ] No secrets, tokens, or `.env` values in code
- [ ] TypeScript: no `any`, no unnecessary type assertions
- [ ] Conventional commit message format (scope must match root policy in `AGENTS.md` and `commitlint.config.cjs`)
- [ ] No `console.log` in production code (use Winston for backend, remove for frontend/mobile)
- [ ] No new `eslint-disable` comments — fix the root cause
- [ ] No new files when editing an existing file would suffice
- [ ] No duplicate imports in any file

### Frontend Specific

- [ ] New UI uses existing `src/app/ui/` components before creating new ones
- [ ] Tailwind tokens used — no hardcoded colors or arbitrary values without justification
- [ ] No new Bootstrap classes added
- [ ] Sonar rules not violated (see `frontend-sonar` skill)
- [ ] Semantic HTML — no `<div role="...">` where a native element exists
- [ ] Keyboard accessibility — interactive elements have `tabIndex` and `onKeyDown`
- [ ] No `<button>` nested inside `<button>`
- [ ] Zustand store used correctly — no duplicated state across stores
- [ ] Cognitive complexity ≤ 15 per function/component
- [ ] No nested ternaries inline in JSX
- [ ] useState destructured correctly; no empty first slot

### Backend Specific

- [ ] Business logic in service layer, not controller
- [ ] All `req.body` inputs validated with Zod
- [ ] No raw MongoDB queries outside model/service layer
- [ ] Background work enqueued via BullMQ, not processed inline
- [ ] Stripe webhook handlers verify signature

### Mobile Specific

- [ ] User-visible strings use `t()` from i18next
- [ ] Navigation uses typed route names
- [ ] Redux for shared/persisted state; `useState` for ephemeral UI state
- [ ] Native permissions requested before use

---

## How to Run a Review

1. Read the changed files.
2. Run through the relevant checklist sections above.
3. For frontend changes, run: `npx tsc --noemit` + `pnpm --filter frontend run lint`.
4. For frontend changes, run targeted tests for every modified file: `pnpm --filter frontend run test -- --testPathPattern="<ModifiedFile>"`. Verify no existing tests are broken by the change.
5. For each issue found, state: file + line, the rule violated, and the fix.
6. Summarize: blocking issues vs. suggestions.
