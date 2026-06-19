# Desktop — Agent Rules

Inherits all root `AGENTS.md` rules. This file adds desktop-specific rules.

**Stack:** Electron 39 (main + preload + renderer), TypeScript, `electron-builder` for
packaging, Jest for unit tests, Playwright for e2e. Frameless `BrowserWindow` with a
`WebContentsView` tab-chrome view stacked over the content views. Local SQLite via `sql.js`,
auto-update via `electron-updater`.

> **Important:** This app packages the production Yosemite Crew web experience as a desktop
> shell. It deliberately excludes the mobile app and the developer portal. Do not pull web
> application code into this workspace — keep the shell thin.

---

## Layout

```
src/
  main.ts                 Electron entry (composition root)
  preload.ts              context-bridge surface
  boot/                   app bootstrap / setup wiring
  shell/                  window + WebContentsView creation
  pages/                  local renderer pages (.html/.css/.js) — strict CSP
  core/ platform/ sync/   domain, OS-integration, and sync logic
  lifecycle/ compliance/  update/lifecycle + compliance helpers
  ui/ utils/              shared renderer UI + utilities
```

Deeper context lives in the app's own docs — read these instead of duplicating them here:
`docs/desktop-architecture.md`, `docs/desktop-perf.md`, `docs/update-feed-threat-model.md`,
`docs/RELEASE-TESTING.md`, and `FEATURES.md`.

---

## Mandatory Checks — run from `apps/desktop/` before declaring a task done

```bash
# 1. Type check — both app and test configs (allow ~120s). Never silently skip.
pnpm run type-check        # = tsc --noEmit && tsc --noEmit -p tsconfig.test.json

# 2. Lint
pnpm run lint              # = eslint .

# 3. Architecture lint (cyclic deps, god modules, dead code/symbols, complexity)
pnpm run archlint

# 4. Tests — the FULL Jest suite is acceptable here (fast, ~12s)
pnpm test                  # or: pnpm run test:coverage
```

Formatting is enforced by Prettier through the repo pre-commit hook (`lint-staged` runs
`prettier --write` on staged files). Run `npx prettier --check "src/**/*.{ts,css,html,js}"`
manually if you want to verify before staging.

> **Contrast with frontend:** the frontend rule that forbids full Jest runs does **not** apply
> to desktop. The desktop suite is small and fast, so run it in full.

---

## Coverage

Thresholds are enforced in `jest.config.js` — they are the source of truth, not a number copied
here. At time of writing: **Statements 95 / Functions 95 / Lines 95, Branches 88**. The branch
bar is intentionally lower because some defensive branches are only reachable in a real Electron
runtime.

Composition-root and static-page glue is excluded from coverage (see `jest.config.js`
`collectCoverageFrom` and `sonar-project.properties` `sonar.coverage.exclusions`):
`src/main.ts`, `src/shell/create-main-window.ts`, `src/boot/setup.ts`, and `src/pages/**`.
Don't write contrived tests to "cover" those — they're excluded on purpose.

---

## Build & Local Pages

```bash
pnpm run build   # = clean:build && tsc && node scripts/copy-static.js
```

`tsc` emits JS to `build/`, then `copy-static.js` copies the non-TS page assets across.

- **Any new local page asset (`.css`/`.js`/`.html`) MUST be added to the `pageAssets` array in
  `scripts/copy-static.js`.** If you forget, the file won't ship and the page breaks at runtime.
- **Local pages live in `src/pages/` and use a strict CSP with no `'unsafe-inline'`.** Inline
  `<style>`, inline `<script>`, and `style=""` attributes must be externalized to `.css`/`.js`
  files (`style-src file:; script-src file:;`). See the `desktop-sonar` skill for the Sonar rule
  that enforces this (`Web:S7039`).

---

## Electron Gotchas

- **Window-drag vs `WebContentsView`:** a top `-webkit-app-region: drag` strip on a base page is
  promoted by Electron to a window-level native drag rect that swallows input to any
  `WebContentsView` stacked above it. Drive window dragging from the tab bar's own spacer via
  pointer deltas instead, and keep the chrome view topmost by re-adding it after content attaches.
- **Deprecated navigation API:** use `webContents.navigationHistory.goBack()/goForward()` (and
  `canGoBack()/canGoForward()`), not the deprecated `webContents.goBack()/goForward()`.

---

## Security

- Packaging hardens the binary via Electron Fuses (`scripts/apply-fuses.js`, run in
  `afterPack`) and notarization (`scripts/notarize.js`, `afterSign`). Don't weaken these.
- `sandbox`/`contextIsolation` defaults and the preload bridge are security boundaries — route
  all renderer→main access through `preload.ts`, never expose Node directly to a page.
- A `security:pressure` script (`pnpm run security:pressure`) exercises hardening assumptions
  after a build; run it if you touch window/CSP/preload wiring.

---

## Quality Gate

Desktop changes must pass **SonarCloud** (project key `yosemitecrew_Yosemite-Crew_Desktop`),
analyzed in CI by `.github/workflows/sonar-cloud-analysis.yml`. Load the `desktop-sonar` skill
for the enforced rule set, the deferral policy, and fix patterns.

---

## Commit Scope

Desktop has **no dedicated `commitlint` scope** — use **`repo`**. Allowed scopes are exactly:
`backend | frontend | mobile | dev-docs | types | fhir | repo | ci | docs`. Allowed types:
`build | chore | ci | docs | feat | fix | perf | refactor | revert | style | test`
(`commitlint.config.cjs` is the source of truth).

---

## What NOT to Do

- Do not introduce inline CSS/JS into `src/pages/` — it breaks the CSP.
- Do not add a page asset without registering it in `copy-static.js`.
- Do not expose Node APIs to renderer pages outside the `preload.ts` bridge.
- Do not weaken Electron Fuses, notarization, or CSP to make something "work".
- Do not pull web app code into this shell — keep it a thin desktop wrapper.
