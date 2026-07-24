# Frontend Release Checklist

Use this checklist before shipping meaningful changes to `apps/frontend` (the Yosemite Crew web app) or cutting a release candidate. It is the pre-ship gate that complements the day-to-day bar in [`FRONTEND_QUALITY_GUIDE.md`](FRONTEND_QUALITY_GUIDE.md).

## Required Validation

- `npx tsc --noemit`
- `pnpm --filter frontend run lint`
- Run targeted Jest coverage for all touched areas.
- Run `pnpm --filter frontend run build`.

## Security and Policy

- Confirm CSP (Content Security Policy) and critical security-header regression tests pass.
- Confirm `script-src` stays nonce-based on authenticated/app routes. Statically-generated public routes intentionally allow `unsafe-inline` scripts (no per-request nonce exists at prerender time) — do not extend that allowance to app routes.
- Confirm `style-src`/`style-src-elem`/`style-src-attr` retain only the existing `unsafe-inline` allowances (React inline styles and pre-rendered styles) — do not add further inline allowances.
- Confirm no new iframe or external URL surface bypasses shared validation helpers.
- Confirm no sensitive token or secret is persisted in client storage.
- Confirm any new storage persistence uses the shared browser storage helpers instead of ad hoc direct access.
- Confirm changes do not widen third-party permissions without a clear reason.

## Performance

- Review the production build summary for obvious route-size regressions.
- Run `pnpm run check:bundle-budgets` from `apps/frontend`.
- Run `pnpm run report:build-routes` from `apps/frontend`.
- Review the route report artifact when a high-traffic route changes materially.

## Accessibility and UX

- Confirm semantic HTML was used where possible.
- Confirm forms, overlays, and menus remain keyboard-accessible.
- Confirm user-facing text does not expose backend enums or internal acronyms.
- Confirm loading, empty, and error states still render correctly.

## Embed Surfaces

- Confirm iframe and other embed surfaces still use allowlisted origins where applicable.
- Confirm blocked or malformed URLs fail closed in the UI.

## CI and Docs

- Confirm CI workflows that enforce frontend quality still pass.
- Update contributor-facing docs when introducing a new quality gate, workflow, or expectation.
