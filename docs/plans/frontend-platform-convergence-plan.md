# Frontend Platform Convergence Plan

## Document Status

- Owner: Frontend platform / design system workstream
- Scope: `apps/frontend`, `apps/mobileAppYC`, `apps/dev-docs`, new shared workspace package(s)
- Monorepo: `pnpm` workspace + `turbo`
- Planning date: March 31, 2026
- Intent: Build a production-grade, agent-friendly UI platform that standardizes the web design system, converges semantic tokens across web and mobile, introduces Storybook for the web app, and establishes accessibility and GxP-ready validation gates.

---

## 1. Executive Summary

Yosemite Crew’s frontend currently has a meaningful reusable UI layer under `apps/frontend/src/app/ui`, but the system is not yet a reliable design platform. Shared components coexist with legacy styling patterns, direct feature-level UI implementations, `react-bootstrap` dependencies, inline colors, inconsistent interactive semantics, and leftover Grotesk-era font variables. There is no Storybook or equivalent component workbench today, and there are zero story files in the repo.

The correct long-term approach is not to bolt Storybook onto the existing surface as-is. The foundation has to be normalized first so Storybook becomes the authoritative contract for UI usage rather than a catalog of inconsistencies. At the same time, the mobile app already has a real theme API and liquid-glass-specific rendering, so the right convergence model is shared semantic tokens with separate platform implementations, not a single shared component library across web and React Native.

This plan creates:

- A shared semantic token package in the monorepo.
- A web Storybook implementation for shared components and representative composites.
- A controlled migration away from legacy Bootstrap-era UI usage in the web app.
- A Satoshi-only typography standard for the web app.
- A documented validation and governance model suitable for accessibility, quality, and GxP-ready engineering workflows.
- A repo structure and documentation model that future AI agents can reliably follow.

---

## 2. Current-State Findings

### 2.1 Repo and workspace facts

- Package manager: `pnpm@8.15.6`
- Workspace model: `pnpm-workspace.yaml` with `apps/*` and `packages/*`
- Task runner: `turbo`
- Frontend app: `apps/frontend`
- Mobile app: `apps/mobileAppYC`
- Docs app: `apps/dev-docs`

### 2.2 Frontend design-system facts

- Shared UI layer exists under `apps/frontend/src/app/ui`
- Token source-of-truth is currently treated as `apps/frontend/src/app/globals.css`
- There are `143` TSX files under `apps/frontend/src/app/ui`
- There are `22` CSS files under `apps/frontend/src/app/ui`
- There are `188` TSX files under `apps/frontend/src/app/features`
- There are currently `0` `*.stories.*` files in the frontend app

### 2.3 Legacy coupling and inconsistency facts

- `react-bootstrap` is still imported in `16` frontend files
- Global Bootstrap CSS is imported in [`apps/frontend/src/app/layout.tsx`](../../apps/frontend/src/app/layout.tsx)
- `18` frontend files still reference Grotesk-era font variables or Grotesk naming
- Current shared components are mixed in quality:
  - Some are token-based and reusable
  - Some still use inline colors
  - Some expose non-ideal APIs
  - Some use non-semantic interactive patterns
- Example current issues observed during planning:
  - [`apps/frontend/src/app/ui/Button.tsx`](../../apps/frontend/src/app/ui/Button.tsx) conflates link/button behavior through an anchor-shaped API
  - [`apps/frontend/src/app/ui/primitives/Accordion/Accordion.tsx`](../../apps/frontend/src/app/ui/primitives/Accordion/Accordion.tsx) uses clickable icons rather than consistently semantic controls
  - [`apps/frontend/src/app/ui/overlays/Modal/ModalBase.tsx`](../../apps/frontend/src/app/ui/overlays/Modal/ModalBase.tsx) needs to be validated against a stronger dialog semantics/focus-management standard
  - [`apps/frontend/src/app/globals.css`](../../apps/frontend/src/app/globals.css) still contains `--font-grotesk` and `--grotesk-font` aliases even though both currently resolve to Satoshi

### 2.4 Mobile theming facts

- Mobile already has a dedicated theme system under `apps/mobileAppYC/src/theme`
- Mobile uses a structured typography/colors/spacing API
- Mobile includes liquid-glass-specific behavior and visual surfaces
- Mobile still contains legacy font names in its theme layer for some cases
- Mobile is not a candidate for forced component-level parity with web, but it is a candidate for semantic token convergence

### 2.5 Documentation facts

- Docusaurus already exists in `apps/dev-docs`
- Docusaurus is serving a broader developer documentation role
- Docusaurus should not be replaced by Storybook
- Storybook should be added as a component workbench and linked from docs

---

## 3. Strategic Decision

### 3.1 Chosen architecture

The system will use:

`centralized semantic tokens + separate web/mobile implementations`

This means:

- Shared meaning is centralized
- Rendering remains platform-specific
- Web and mobile consume the same token contract
- Web uses CSS/Tailwind/theme outputs
- Mobile maps the same semantic contract into React Native theme objects
- Mobile liquid-glass remains a mobile implementation concern, not a shared DOM/CSS concern

### 3.2 Explicitly rejected alternatives

#### Single cross-platform component system

Rejected because:

- Next.js and React Native have different rendering constraints
- The mobile app already has platform-native theming patterns
- Liquid-glass behavior is platform- and OS-dependent
- It would create brittle abstractions and slow the repo down

#### Replacing Docusaurus with Storybook

Rejected because:

- Storybook is a UI workbench and component docs tool
- Docusaurus is better for architecture docs, contributor guidance, validation docs, governance, and long-form engineering content
- Both tools solve different problems and should coexist

#### Storybook-first without foundation cleanup

Rejected because:

- The current component layer is not clean enough to become the long-term source of UI truth
- Cataloging inconsistencies would create documentation debt, not a design system

---

## 4. Target End State

At the end of the full program, the repo should have:

- A shared token package in `packages/`
- A web Storybook in `apps/frontend` with story coverage for all approved shared components
- A documented UI taxonomy that distinguishes primitives, shared composites, and feature-only components
- A Satoshi-only web typography system with Grotesk fully removed from the frontend app
- A phased but deliberate migration path off `react-bootstrap` in the frontend
- Accessibility checks integrated into the UI development workflow
- Story-driven interaction coverage for shared interactive components
- A Docusaurus UI-system section documenting contribution rules and future agent usage
- A validation matrix and evidence model suitable for GxP-ready engineering controls
- Mobile theme convergence at the semantic-token level without damaging platform-specific rendering quality

---

## 5. Workstream Breakdown

## 5.1 Workstream A: Shared Semantic Token Package

### Objective

Create a single source of truth for design decisions that can be consumed by web, mobile, and documentation.

### Deliverable

New workspace package:

- `packages/design-tokens`

### Responsibilities

This package will define:

- Color tokens
- Typography role tokens
- Spacing scale
- Radius scale
- Shadow scale
- Layering/z-index tokens
- Motion/duration/easing tokens
- Component-state tokens where needed
- Semantic aliases for shared meaning across web and mobile

### Principles

- Tokens must be semantic, not purely raw-value driven
- Token names should describe intent, not platform details
- No app-specific business logic in the package
- Generated outputs may differ by platform, but meaning must stay consistent

### Outputs

The package should export:

- Raw token JSON
- Typed TS accessors/helpers
- Web-consumable output for CSS variables / Tailwind integration
- Mobile-consumable TS objects for theme mapping
- Optional docs metadata for Docusaurus and Storybook

### Example token categories

- `color.text.primary`
- `color.text.secondary`
- `color.surface.card`
- `color.surface.glass`
- `color.border.default`
- `color.border.muted`
- `color.action.primary.bg`
- `color.action.primary.text`
- `spacing.2`
- `spacing.4`
- `radius.md`
- `radius.xl`
- `typography.body.md`
- `typography.heading.lg`
- `motion.fast`
- `motion.normal`

### Constraints

- This package should remain technology-neutral
- It should not encode DOM structure or React Native component logic
- It should not become a dumping ground for app-specific one-offs

---

## 5.2 Workstream B: Web Token Migration

### Objective

Move the web app from a monolithic hand-authored `globals.css` token definition model to a generated token-consumer model.

### Current source

- [`apps/frontend/src/app/globals.css`](../../apps/frontend/src/app/globals.css)

### Target behavior

- `globals.css` becomes a consumer of generated web token outputs
- It retains:
  - app-level resets
  - Tailwind integration
  - base element defaults
  - layout-wide global styles that are not token ownership concerns
- It stops being the long-term hand-authored home for semantic tokens

### Required changes

- Replace direct token authoring in `globals.css` with imported/generated outputs
- Rationalize duplicate aliases
- Eliminate legacy naming that no longer reflects design intent
- Preserve existing UI during migration by keeping values stable until downstream components are migrated

### Important migration rule

This must be done with minimal behavioral change at first. Token ownership should move before visual redesign.

---

## 5.3 Workstream C: Web Typography Standardization

### Objective

Make the web app Satoshi-only and remove Grotesk completely from the frontend app.

### Required changes

- Remove `--font-grotesk`
- Remove `--grotesk-font`
- Replace all frontend Grotesk-era references with the correct Satoshi semantic tokens
- Update docs and token references so they no longer recommend Grotesk usage
- Remove unused frontend Grotesk font assets/imports from `apps/frontend/public` once no longer referenced
- Normalize frontend CSS files that still use Grotesk aliases

### Files already known to require attention

This includes at least:

- onboarding CSS
- overview CSS
- legal page CSS
- summary widgets
- tables
- OTP modal styles
- upload styles
- file input styles
- launch/grow tabs
- footer/marketing surfaces where legacy typography aliases survive

### Important boundary

This web-only Satoshi standard does not automatically force a full mobile typography rewrite in the same batch.

---

## 5.4 Workstream D: Storybook For Web

### Objective

Introduce Storybook as the canonical web component workbench and component documentation surface.

### Framework choice

Use:

- `@storybook/nextjs-vite`

Default reason:

- Official Storybook guidance recommends the Vite-based framework for most Next.js projects
- It is faster and better aligned with current Storybook testing capabilities

Fallback:

- Only use webpack Storybook if an actual compatibility blocker is found during implementation

### Storybook responsibilities

Storybook must become the place where engineers and future agents can:

- discover shared components
- understand component APIs
- review visual states
- run accessibility checks
- validate interactions
- inspect tokens/themes
- determine whether a component is approved for new usage

### Story colocation strategy

Stories should live beside the components they document:

- `Component.tsx`
- `Component.stories.tsx`

Reason:

- Better discoverability
- Better maintenance ownership
- Better compatibility with future AI agents navigating the repo

### Storybook setup requirements

- Global styles/decorators wired to frontend theme/tokens
- Required providers and mocks
- Router/navigation mocks
- Zustand/store fixture support where needed
- Viewport presets
- Reduced-motion toggle
- Theme or token-display toggles
- Docs/autodocs support
- Accessibility addon
- Interaction testing support for stateful components

### Coverage expectation

Story coverage is required for:

- all shared primitives
- all shared inputs
- all shared overlays
- all navigation/layout components
- all shared cards/tables/widgets that remain approved for reuse
- representative complex composites that define key patterns

Story coverage is not required for every feature-specific page component on day one, but feature-heavy shared patterns should be represented.

---

## 5.5 Workstream E: Web UI Inventory And Taxonomy

### Objective

Create an explicit map of the current UI system so the remediation work is controlled and future contributors know where code belongs.

### Taxonomy

All frontend UI should be classified into one of:

- Tokens
- Primitives
- Inputs
- Overlays
- Layout/Navigation
- Cards/Tables/Widgets
- Shared composites
- Feature-only composites
- Legacy/deprecated components

### Why this matters

Without taxonomy:

- Storybook becomes noisy
- Governance is unclear
- Future agents cannot tell whether they should reuse or create
- Deprecation becomes impossible to manage

### Deliverables

- A generated or maintained inventory document
- Storybook navigation categories aligned with taxonomy
- Docusaurus documentation explaining classification rules
- Explicit “approved for new usage” vs “legacy” labels

---

## 5.6 Workstream F: Shared Web Primitive Stabilization

### Objective

Make the shared `ui/` layer trustworthy before broad feature migration.

### Priority targets

- `Button`
- `Input`
- `Text`
- `Stack`
- `Card`
- `Badge`
- Accordion primitives
- Modal/dialog primitives
- Search/select/dropdown/input families
- Toasts/loaders
- Sidebar/header
- Universal search
- Reusable table primitives
- Reusable card primitives

### Expected work

For each shared component:

- validate API shape
- remove visual hardcoding
- align with token contract
- align with accessibility semantics
- add or update tests
- add Storybook stories
- add usage docs and status metadata

### Known example issues to fix

#### Button

Current API is not ideal because it is shaped like an anchor wrapper rather than an explicit button/link abstraction.
Required fix:

- split semantic button and link behavior clearly
- define disabled/loading/navigation behavior intentionally
- preserve or migrate callsites safely

#### Accordion

Current implementation needs stronger semantics and control patterns.
Required fix:

- semantic toggles
- keyboard safety
- clear controlled/uncontrolled behavior
- no clickable decorative icons acting as controls

#### Modal/dialog layer

Current modal base needs a stronger dialog standard.
Required fix:

- focus management
- escape handling
- accessible labeling strategy
- close-policy rules
- safer outside-click rules
- consistent overlay/container composition

---

## 5.7 Workstream G: Legacy Bootstrap Removal In Web

### Objective

Remove `react-bootstrap` and global Bootstrap dependency from the frontend app in a controlled way.

### Current-state facts

- `react-bootstrap` is still used in `16` frontend files
- global bootstrap CSS is loaded in [`apps/frontend/src/app/layout.tsx`](../../apps/frontend/src/app/layout.tsx)

### Strategy

This is not a one-shot removal.
It will happen in phases:

1. identify every remaining `react-bootstrap` consumer
2. replace each use with first-party token-based UI
3. validate layout/behavior parity
4. remove Bootstrap CSS import only when no remaining dependency requires it

### Important rule

Bootstrap removal must follow replacement readiness, not ideology.

### Likely migration areas

- auth forms
- toast/modal wrappers
- upload flows
- FAQ accordion
- footer/container usages
- marketing page widgets/carousels if any shared dependency remains

---

## 5.8 Workstream H: Shared Feature Pattern Sweep In Web

### Objective

After shared primitives are stable, sweep major shared patterns and representative feature surfaces that currently bypass the design system.

### Representative targets

- side modals
- iframe/PDF/document overlays
- appointment detail panels
- onboarding steps
- upload/document flows
- FAQ/accordion implementations
- search/filter panels
- selectors/pills
- custom inputs
- feature-specific cards/tables that should either become shared or be documented as feature-only

### Decision rule per component

Every audited component must end in one of these states:

- promote to shared component
- keep as feature-only composite with docs
- deprecate and replace
- mark legacy and block new usage until refactored

---

## 5.9 Workstream I: Mobile Token Convergence

### Objective

Align the mobile app’s theme API with the same semantic token contract without forcing identical rendering.

### Current-state advantage

Mobile already has:

- `colors.ts`
- `typography.ts`
- `spacing.ts`
- theme mapping structure

This makes convergence feasible at the token level.

### Required changes

- map mobile theme values to the shared semantic token package
- standardize semantic naming between web and mobile
- preserve mobile-only visual behavior such as liquid-glass implementation details
- document intentional divergences

### Explicit non-goals

- no shared React component implementation between web and mobile
- no forced removal of all mobile-specific typography exceptions in the first convergence pass
- no flattening of iOS-specific liquid-glass behavior into generic web tokens

---

## 5.10 Workstream J: Documentation And Agent-Friendliness

### Objective

Make the UI platform understandable and extendable by humans and future agents.

### Docusaurus should document

- design token philosophy
- token package ownership
- web vs mobile convergence model
- component taxonomy
- approved shared components
- story authoring rules
- accessibility requirements
- testing expectations
- deprecation/legacy rules
- how future agents should add new UI

### Storybook should document

- actual component API surface
- states and variants
- interaction contracts
- accessibility notes
- token dependencies
- approval status

### Agent-friendly standards

- colocated stories
- predictable naming
- clear package ownership
- explicit status labels
- examples showing preferred usage
- no hidden design rules living only in people’s heads

---

## 5.11 Workstream K: Accessibility And GxP-Ready Validation Gates

### Objective

Create measurable engineering controls and validation evidence for UI quality.

### Accessibility gates

At minimum:

- Storybook accessibility checks with `@storybook/addon-a11y`
- semantic interactive controls
- keyboard navigability for interactive primitives
- labeling correctness for forms and dialogs
- visible state distinctions not based on color alone where applicable
- focus handling for overlays and menus

### Interaction evidence

Use Storybook interaction coverage for:

- modal open/close
- accordion open/close
- selector and pill state changes
- search and combobox behavior
- form validation states
- destructive confirmations
- upload interactions where appropriate

### Testing role separation

- Jest/RTL remains the canonical unit/integration test layer
- Storybook is the discoverability and component workbench layer
- Storybook interactions reinforce behavior and accessibility, not replace application tests

### GxP-ready interpretation

The repo should not claim “GxP certified UI.”
Instead, it should provide:

- risk-ranked component validation expectations
- explicit evidence categories
- reproducible checks
- traceable docs
- manual review checklists for high-risk interfaces

### High-risk UI classes needing explicit validation checklists

- dialogs and modals
- destructive actions
- file upload flows
- financial displays
- consent/signature surfaces
- embedded iframe/document viewers
- data-heavy tables with critical actions

### Validation matrix structure

Each component class should map to:

- required unit/integration tests
- required story coverage
- required accessibility checks
- keyboard behavior requirement
- responsive review requirement
- manual validation requirement if automation is insufficient

---

## 6. Component Governance Model

## 6.1 Status labels

Each shared component should carry one of:

- Approved
- In migration
- Legacy
- Deprecated

### Meaning

- Approved: allowed for new development
- In migration: allowed only with caution while replacement work completes
- Legacy: existing use allowed, new use blocked
- Deprecated: replacement required; removal planned

## 6.2 Approval criteria

A component is only “Approved” when it has:

- token alignment
- stable API
- tests
- story coverage
- accessibility review
- usage docs
- clear ownership/category

## 6.3 New component creation rule

A new shared component should only be created if:

- no approved existing component fits
- the new component represents a reusable pattern
- it ships with stories and tests in the same batch

---

## 7. Phased Execution Plan

## Phase 1: Inventory And Monorepo Foundation

### Goals

- create `packages/design-tokens`
- define token ownership model
- add Storybook base setup
- create the UI inventory/taxonomy
- identify all `react-bootstrap` and Grotesk-era references

### Outputs

- token package skeleton
- Storybook bootstrapped in frontend
- initial docs scaffolding
- inventory report
- migration backlog by category

---

## Phase 2: Token Ownership And Typography Cleanup

### Goals

- move semantic token ownership into the shared package
- convert web to generated token consumption
- make frontend Satoshi-only
- remove Grotesk aliases and dead frontend font references
- align mobile naming to shared token semantics

### Outputs

- shared token contract
- cleaned `globals.css`
- frontend font cleanup
- mobile semantic mapping baseline

---

## Phase 3: Shared Primitive And Overlay Stabilization

### Goals

- refactor the most foundational shared web components
- add stories/docs/tests
- fix highest-severity accessibility issues
- define stable API patterns

### Outputs

- approved primitive layer
- approved overlay/dialog layer
- approved input family baseline
- initial accessibility gates running

---

## Phase 4: Shared Composite And Feature Pattern Sweep

### Goals

- migrate high-reuse composite patterns
- reduce feature-level inconsistency
- replace more `react-bootstrap` usage
- document which patterns are shared vs feature-only

### Outputs

- wider story coverage
- reduced legacy styling patterns
- broader design-system adoption

---

## Phase 5: Mobile Convergence And Docs Maturity

### Goals

- converge mobile theme semantics fully
- document web/mobile token contract
- preserve liquid-glass implementation separation
- expand Docusaurus guidance for contributors and agents

### Outputs

- mobile theme alignment
- cross-platform docs
- future-agent contribution guide

---

## Phase 6: Governance, Validation, And Hardening

### Goals

- finalize validation matrix
- add CI/Turbo checks for Storybook and tokens
- mark approved/legacy components clearly
- complete Bootstrap removal where feasible
- formalize long-term contribution standards

### Outputs

- governed UI platform
- durable docs
- CI-backed quality gates
- maintainable component lifecycle rules

---

## 8. Detailed Acceptance Criteria

### 8.1 Shared token package

- Exists as a workspace package
- Consumed by frontend and mobile
- Semantic token naming documented
- No app-specific business logic inside package

### 8.2 Frontend typography

- No frontend Grotesk aliases remain
- No frontend Grotesk font assets/imports remain in active use
- Web uses Satoshi consistently through tokens/utilities

### 8.3 Storybook

- Runs locally in `apps/frontend`
- Has stories for all approved shared components
- Includes accessibility addon
- Includes interaction coverage for interactive primitives
- Includes docs/autodocs metadata

### 8.4 Shared UI quality

- Core primitives have stable APIs
- Interactive components meet semantic expectations
- Shared components use tokens rather than hardcoded colors where practical
- Legacy/new-usage boundaries are documented

### 8.5 Bootstrap dependency

- All frontend `react-bootstrap` usages are inventoried
- Replacements are implemented before removal
- Bootstrap CSS import is removed only when safe

### 8.6 Mobile convergence

- Shared semantic token names map cleanly into mobile theme objects
- Liquid-glass remains supported
- Platform-specific UI behavior remains possible

### 8.7 Documentation

- Docusaurus contains a UI system section
- Storybook is linked from docs
- Contribution rules are explicit
- Future agents can discover preferred patterns from repo artifacts

### 8.8 Validation

- Accessibility checks exist for Storybook-covered components
- Targeted test expectations are defined for touched components
- High-risk UI classes have manual validation checklists
- GxP-ready evidence model is documented

---

## 9. Testing And Validation Plan

## 9.1 Frontend checks for touched batches

Run:

```bash
cd apps/frontend
npx tsc --noemit
pnpm --filter frontend run lint
pnpm --filter frontend run test -- --testPathPattern="<relevant-file>"
```

## 9.2 Mobile checks for touched batches

Run:

```bash
cd apps/mobileAppYC
npx tsc --noemit
pnpm --filter mobileAppYC run lint
pnpm --filter mobileAppYC run test -- --testPathPattern="<relevant-file>"
```

## 9.3 Storybook-specific validation

Add:

- Storybook build verification
- accessibility addon checks
- interaction stories for shared interactive components
- responsive viewport review for mobile/tablet/desktop

## 9.4 E2E role

Use Playwright only for flows that are actually end-to-end critical, not to replace component workbench coverage.

---

## 10. Risks And Mitigations

### Risk: Storybook adoption without cleanup creates permanent documentation debt

Mitigation:

- stabilize primitives first
- use approval status labels
- do not mark legacy surfaces as canonical

### Risk: token migration breaks existing UI unexpectedly

Mitigation:

- keep values stable initially
- move ownership before redesign
- migrate in thin slices with targeted validation

### Risk: Bootstrap removal causes regressions in legacy areas

Mitigation:

- inventory every remaining use first
- replace usage incrementally
- only remove global CSS after dependency elimination

### Risk: trying to force web/mobile component parity harms both platforms

Mitigation:

- share semantics only
- keep runtime implementation separate
- preserve mobile liquid-glass specialization

### Risk: “GxP compliance” is interpreted as a formal certification claim

Mitigation:

- document the scope as GxP-ready engineering controls
- tie work to validation evidence, traceability, and risk-based testing
- avoid overstating compliance claims in docs

### Risk: future contributors bypass the system again

Mitigation:

- document preferred paths
- colocate stories
- clearly mark approved vs legacy components
- add governance and CI gates

---

## 11. Decisions Locked By This Plan

- Monorepo model is first-class in the implementation.
- Docusaurus stays.
- Storybook is added for `apps/frontend`.
- Shared tokens live in a workspace package.
- Web and mobile share semantic tokens, not component implementations.
- Frontend web becomes Satoshi-only.
- Bootstrap is removed from the frontend gradually, not in one risky batch.
- Shared primitives and overlays are the first remediation priority.
- GxP is handled as evidence-backed engineering controls, not a blanket certification claim.

---

## 12. Explicit Non-Goals

- Building a single web/mobile component library
- Replacing Docusaurus with Storybook
- Declaring the system formally certified or validated by implementation alone
- Running a full visual redesign of every screen before token migration is complete
- Rewriting the entire mobile app’s rendering layer to match web implementation details

---

## 13. Proposed File/Ownership Direction

### New or changed ownership areas

- `packages/design-tokens`
- `apps/frontend/.storybook`
- `apps/frontend/src/app/**/*.stories.tsx`
- `apps/dev-docs` UI-system documentation section
- `apps/mobileAppYC/src/theme/*` consumption refactor

### Existing frontend areas to prioritize

- `apps/frontend/src/app/globals.css`
- `apps/frontend/src/app/ui/*`
- `apps/frontend/src/app/layout.tsx`
- feature-heavy shared patterns under `apps/frontend/src/app/features/*`

---

## 14. Future Agent Rules This Plan Intends To Enable

Future agents should be able to infer:

- where tokens live
- which components are approved
- how to add a new story
- how to map mobile/web semantics
- how to validate a shared component
- whether a feature component should be promoted or kept local
- what tests and docs are required for UI changes

This becomes possible only if the final implementation leaves:

- a clear token package
- colocated stories
- docs in Docusaurus
- explicit status labels
- stable shared APIs
- no hidden font or styling conventions

---

## 15. Final Recommendation

Implement this as a multi-phase platform program, not a one-off Storybook setup task.

The first implementation batch should focus on:

1. workspace token package foundation
2. Storybook bootstrapping in `apps/frontend`
3. web Satoshi-only font cleanup
4. shared primitive and overlay audit/remediation
5. Docusaurus documentation scaffolding for the new UI system

That sequence gives the repo the strongest long-term foundation, keeps the monorepo architecture coherent, and creates the best conditions for future human and AI contributors to extend the product without reintroducing inconsistency.
