# Frontend Release Checklist

Use this checklist before shipping meaningful frontend changes or cutting a release candidate.

## Required Validation

- `npx tsc --noemit`
- `pnpm --filter frontend run lint`
- Run targeted Jest coverage for all touched areas.
- Run `pnpm --filter frontend run build`.

## Security and Policy

- Confirm CSP and critical security-header regression tests pass.
- Confirm `script-src`, `style-src`, and `style-src-elem` remain nonce-based and do not regain `unsafe-inline`.
- Confirm `style-src-attr 'unsafe-inline'` remains the only inline CSP compatibility allowance.
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
