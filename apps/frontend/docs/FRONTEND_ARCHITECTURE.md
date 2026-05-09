# Frontend Architecture

This document describes the intended boundaries for `apps/frontend`.

## High-Level Structure

The app uses the Next.js App Router with feature-oriented organization.

```text
src/app
  (routes)/        Next.js route groups and route entry points
  config/          Route config, app-level wiring, static config
  constants/       Stable app constants and config values
  features/        Domain modules that own pages and local implementation
  hooks/           Shared cross-feature hooks
  lib/             Shared helpers, URL safety, and pure utilities
  services/        HTTP clients and transport helpers
  stores/          Zustand state containers
  ui/              Shared primitives, inputs, overlays, and layout building blocks
```

## Ownership Rules

### Routes

- Route files should stay thin.
- Route files should compose feature pages rather than own business logic.
- Route wrappers are a valid place for page-level dynamic imports.

### Features

- Each feature owns its domain-specific pages, components, hooks, services, and types.
- Cross-feature dependencies should stay shallow. Prefer shared helpers or shared UI over feature-to-feature reach-through.
- Avoid barrel files that accidentally pull entire feature trees into a route bundle.

### UI

- `src/app/ui` is the shared design system surface.
- Shared primitives, form controls, overlays, and layout scaffolding belong here.
- Feature-specific variants stay in the feature unless they are reused broadly enough to promote.

### Stores

- Zustand is the only client-state library used here.
- Keep one store per domain concern.
- Store files should expose state and actions, not feature rendering concerns.
- Prefer selectors and focused hooks over large components reading entire stores.

### Hooks

- Shared hooks belong in `src/app/hooks`.
- Hooks that are only meaningful to one feature should remain inside that feature.
- Hooks should encapsulate data flow, permissions, or derived state, not large presentational trees.

### Services and Lib

- `services/` owns HTTP interaction and transport details.
- `lib/` owns pure helpers and safety primitives such as URL validation.
- Storage access should prefer shared wrappers in `lib/browserStorage.ts` so failure handling stays consistent.
- Keep side effects out of shared helpers when a pure function will do.

## Security Boundaries

- All external URLs should be validated before use in iframes, redirects, or downloads.
- Existing non-signing iframe/embed surfaces should follow the shared-safe pattern: validated origins where applicable plus least-privilege referrer policy and sandboxing where compatible.
- Sensitive workflows such as document signing should fail closed on bad or missing origin data.
- Storage access should be centralized over time instead of scattered direct `localStorage` and `sessionStorage` usage.
- Critical header and CSP expectations must stay testable.

## Performance Boundaries

- Heavy route sections should load dynamically when they are not needed for first paint.
- Large modal flows should not be part of the initial bundle.
- Shared imports should be reviewed when a route begins trending upward in CI route reports.
- Prefer direct dynamic imports over broad barrels when bundle splitting matters.

## Testing Boundaries

- Unit tests should cover helpers, services, and stores.
- Component tests should cover rendering, interaction, and branching UI.
- Route-level tests should verify wrappers and access-sensitive behavior.
- Security-sensitive helpers and config should have direct regression coverage.

## Documentation Boundaries

- Contributor-facing quality expectations live in `docs/FRONTEND_QUALITY_GUIDE.md`.
- Release checks live in `docs/FRONTEND_RELEASE_CHECKLIST.md`.
- Long-running quality debt should be tracked in focused issues or implementation docs, not temporary local reports.

## Anti-Patterns

- Putting business logic directly into route files.
- Creating new shared UI without checking existing primitives first.
- Reaching into another feature's internals instead of promoting a real shared abstraction.
- Adding iframe or external-URL usage without validation and policy review.
- Pulling multiple heavy sections through a single barrel import when route-level splitting matters.
