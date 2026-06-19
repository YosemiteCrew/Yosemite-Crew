---
name: desktop-sonar
description: Use when fixing SonarCloud issues in apps/desktop or writing Sonar-clean Electron and renderer code. Covers the enforced rule categories, the accepted role=dialog deferral, CSP and page-asset rules, and links the live SonarCloud project.
---

# Desktop SonarQube Rules — Yosemite Crew

## Description

Use this skill when fixing SonarCloud issues in `apps/desktop`, or when writing new desktop code
that must pass Sonar checks. Covers the rule categories enforced on the desktop project, the
accepted deferral, and the fix patterns — plus where the authoritative issue list lives.

TRIGGER: any mention of "sonar", "code quality", or "lint issues" while working in `apps/desktop`,
or when writing new Electron/renderer code.

> Surface note: this is the Claude Code copy. Mandatory checks live in `apps/desktop/AGENTS.md`;
> the skill index is in the repo root `CLAUDE.md`. The Codex copy is `.agents/skills/desktop-sonar/`.

---

## Authoritative Source — Do Not Freeze a Snapshot

The single source of truth for open issues is the **SonarCloud project
`yosemitecrew_Yosemite-Crew_Desktop`**, analyzed in CI by
`.github/workflows/sonar-cloud-analysis.yml`. The rule mix changes over time, so **check the live
project for the current list** rather than trusting any static dump. This skill documents the
_categories_ and _fix patterns_ that recur on this codebase, not a frozen issue count.

Do not reference the gitignored local-only Sonar tooling in any tracked file — that workflow lives
in the gitignored `CLAUDE.local.md`.

---

## Mandatory Checks — run from `apps/desktop/` after every change

```bash
pnpm run type-check   # tsc (app) + tsc (tests)
pnpm run lint         # eslint .
pnpm run archlint     # local proxy for complexity / cyclic deps / dead code
pnpm test             # full Jest suite (fast here)
```

There is **no `eslint-plugin-sonarjs`** wired into desktop. The local proxy for cognitive /
cyclomatic complexity and dead code is **`archlint`** (`.archlint.yaml`). The authoritative
complexity and smell check is still the SonarCloud analysis.

---

## Accepted Deferral

- **`Web:S6819`** (prefer native `<dialog>` over `role="dialog"`) is **deferred** in
  `src/pages/tabbar.html` where the overlay is shown/hidden via a CSS class or inline-display
  toggle rather than `showModal()`. Converting to a native `<dialog>` would change show/hide
  semantics, so these instances are intentionally left as-is. Do not "fix" them blindly — match
  the existing deferral unless you are also migrating the show/hide mechanism.

---

## Security & Reliability (fix immediately — these are bugs/vulns, not smells)

- **`Web:S7039` — CSP `unsafe-inline`.** Externalize inline `<style>`/`<script>`/`style=""` to
  `.css`/`.js` files; keep `style-src file:; script-src file:;`. **Register every new file in
  `scripts/copy-static.js` `pageAssets`** or it won't ship.
- **`Web:InputWithoutLabelCheck`.** Every input needs an associated `<label>` or an `aria-label`.

---

## TypeScript / JS Rules (with one-line fixes)

| Rule               | Fix                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | --- | ---------------------------------------------- |
| `typescript:S1874` | Deprecated `webContents.goBack()/goForward()` → `webContents.navigationHistory.goBack()/goForward()` (also `canGoBack/canGoForward`). |
| `*:S7764`          | Prefer `globalThis` over bare `window` in renderer page scripts.                                                                      |
| `*:S7761`          | Prefer `.dataset` over `get/set/removeAttribute('data-…')`.                                                                           |
| `*:S6582`          | Optional chaining: `a && a.b` → `a?.b`.                                                                                               |
| `typescript:S6606` | Nullish coalescing: `                                                                                                                 |     | `→`??`/`??=`when the left side can be`0`/`''`. |
| `typescript:S7741` | `=== undefined` over `typeof x === 'undefined'`.                                                                                      |
| `*:S7735`          | Invert unexpected negated conditions (`if(!x){A}else{B}`) or use an early return.                                                     |
| `*:S3358`          | Extract nested ternaries into a named helper.                                                                                         |
| `typescript:S3776` | Cognitive complexity > 15 → extract helper functions.                                                                                 |
| `typescript:S2004` | Functions nested > 4 levels → extract.                                                                                                |
| `typescript:S4325` | Remove unnecessary type assertions.                                                                                                   |
| `typescript:S7748` | No zero-fraction numbers (`1.0` → `1`).                                                                                               |
| `typescript:S6564` | Remove redundant type alias.                                                                                                          |
| `typescript:S6598` | Type literal with only a call signature → function type.                                                                              |
| `typescript:S6551` | Robust error stringify: `error instanceof Error ? error.message : String(error)`.                                                     |
| `typescript:S7754` | `.some()` over `.find()` when the result is used as a boolean.                                                                        |
| `typescript:S2486` | Handle the caught error, or use a paramless `catch {}` for a deliberate ignore.                                                       |
| `typescript:S7780` | `String.raw` for strings containing backslashes.                                                                                      |
| `typescript:S7743` | Avoid a confusing IIFE with a parenthesized arrow body.                                                                               |
| `typescript:S3735` | Remove a stray `void` operator. (`void promise` to satisfy `no-floating-promises` is fine and is **not** what this flags.)            |
| `typescript:S4043` | Copy before sorting: `[...arr].sort()` / `.toSorted()`.                                                                               |

### Modern method preferences

| Rule      | Fix                                                                 |
| --------- | ------------------------------------------------------------------- | --- |
| `*:S6557` | `String.startsWith(...)` over regex/`indexOf` at position 0.        |
| `*:S7781` | `String.replaceAll(...)` over global-regex `replace`.               |
| `*:S7765` | `.includes()` over `indexOf(…) !== -1`.                             |
| `*:S7758` | `codePointAt` / `String.fromCodePoint` over the char-code variants. |
| `*:S7767` | `Math.trunc(x)` over `x                                             | 0`. |

> Note: `javascript:S3504` ("declare with `let`/`const`, not `var`") has shown up in volume on
> recent scans of generated/page scripts — replace `var` with `const`/`let`. Always confirm the
> current top rules against the live SonarCloud project before a cleanup sweep.

---

## Gotchas

- `eslint --fix` auto-fixes some of these but **not** CSP, accessibility, or complexity issues —
  fix those by hand.
- After any fix, re-run `pnpm run type-check && pnpm run lint && pnpm run archlint` before marking
  resolved; the final word is the SonarCloud analysis in CI.
- Externalizing a page asset is only half the fix — it must also be added to `copy-static.js`.
