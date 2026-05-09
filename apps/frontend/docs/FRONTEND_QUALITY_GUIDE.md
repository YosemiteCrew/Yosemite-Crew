# Frontend Quality Guide

This guide defines the minimum engineering bar for changes in `apps/frontend`.

## Objectives

- Keep the web app safe by default for staff and pet-parent workflows.
- Preserve performance on key routes and prevent regressions from drifting in silently.
- Make contributions predictable for internal and external contributors.
- Keep accessibility, test quality, and maintainability aligned with production use.

## Baseline Standards

- Use `pnpm`, never `npm` or `yarn`.
- Prefer the smallest safe change that solves the problem.
- Update tests in the same batch whenever behavior changes.
- Avoid `any` unless the boundary genuinely cannot be typed.
- Do not expose backend enums, raw codes, or internal acronyms in UI copy.
- Reuse shared UI primitives from `src/app/ui` before creating new components.

## Security Expectations

- Treat every iframe, script, storage read, and external URL as hostile until validated.
- Use shared URL and embed helpers for third-party or cross-origin content.
- Prefer shared browser storage helpers from `src/app/lib/browserStorage.ts` over ad hoc `localStorage` or `sessionStorage` access.
- Fail closed when a required URL, token, or config value is invalid.
- Keep the nonce-based CSP and critical response headers intact. Regressions must fail tests or CI.
- Do not add inline scripts. Load third-party scripts as external sources allowed by CSP.
- `style-src-attr 'unsafe-inline'` is retained only for existing React inline style attributes. Do not expand inline script or style-element allowances.
- Do not introduce new client-side persistence for secrets or signing/session tokens.

## Accessibility Expectations

- Prefer semantic HTML over ARIA workarounds.
- Use native interactive elements instead of clickable `div` or `span`.
- Ensure keyboard navigation and visible focus states for interactive surfaces.
- Keep labels, helper text, and errors explicit for form controls.
- Treat DOM nesting warnings and invalid roles as failures, not as cleanup debt.

## Performance Expectations

- Default to route-level or modal-level code splitting for heavy surfaces.
- Keep large tables, editors, timelines, and chart bundles out of the first render path.
- Watch route-size artifacts and bundle budgets in CI after every meaningful UI change.
- Avoid introducing large shared imports into multiple top-level routes without need.
- Prefer progressive loading for secondary panels, overlays, and settings sections.

## Testing Expectations

- Run `npx tsc --noemit` from `apps/frontend`.
- Run `pnpm --filter frontend run lint`.
- Run targeted Jest tests for every touched file that already has coverage.
- Add tests for new logic, new components, new helpers, and new state branches.
- Prefer behavioral assertions over snapshots. Use snapshots only as a complement.

## CI Expectations

- CI should block on typecheck, lint, targeted security regressions, and production build health.
- Browser coverage should stay at least Chromium and Firefox unless the workflow is explicitly narrowed.
- Bundle budgets and route-size artifacts are part of the quality gate, not optional reporting.
- `@typescript-eslint/no-unused-vars` is enforced. Use underscore-prefixed names only for intentionally ignored values.

## Contribution Checklist

Before handing off a frontend change:

- Confirm the user-facing behavior is correct.
- Confirm the change does not weaken CSP, header policy, or embed safety.
- Confirm touched routes did not regress badly in build output.
- Confirm matching tests were updated or added.
- Confirm the docs or checklist were updated if the quality bar changed.
- Reduce `any` in touched code where practical. `no-explicit-any` is still a gradual hardening target.

## Open-Source Expectations

- Prefer readable patterns over clever local optimizations.
- Leave clear ownership boundaries between features, stores, services, and UI.
- Document new contributor-facing workflows when adding new tooling or guardrails.
- Keep the repo in a state where an outside contributor can understand how to make a safe change.
