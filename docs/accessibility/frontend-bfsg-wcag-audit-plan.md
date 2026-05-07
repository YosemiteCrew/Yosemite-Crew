# Frontend BFSG Accessibility Audit and Remediation Plan

Last updated: 2026-05-06

## Purpose

This document is the working handoff for bringing `apps/frontend` to production-grade accessibility for Germany and the EU market.

It is written for future agents and engineers who will implement the work in batches without losing legal context, technical rigor, or audit traceability.

This is not legal advice. It is an engineering compliance plan based on:

- BFSG / Barrierefreiheitsstärkungsgesetz
- BFSGV / Verordnung zum BFSG
- EU Directive 2019/882 (European Accessibility Act)
- WCAG 2.1 AA as the legal floor you referenced
- WCAG 2.2 AA as the recommended engineering target because it remains backward-compatible with 2.1 and is the current W3C recommendation set

## Regulatory baseline

As of **June 28, 2025**, the German BFSG applies to certain private-sector products and services, including **consumer banking services** and **services in electronic commerce**. The law requires covered services to be accessible, and the implementing regulation defines concrete requirements for e-commerce, including accessibility of identification, authentication, security, and payment flows.

Important points:

- `BFSG §1` says the law applies to covered services provided to consumers from **June 28, 2025** onward.
- `BFSG §3` says covered services must be accessible so people with disabilities can find, access, and use them in the usual way, without particular difficulty and generally without outside help.
- `BFSGV §19` adds e-commerce-specific requirements for:
  - accessibility information about products/services
  - identification, authentication, security, and payment functions
  - signatures and payment services where provided
- `BFSG Anlage 3` requires service providers to state in T&Cs or another clearly perceivable place how the service meets accessibility requirements, including the responsible market surveillance authority.
- `BFSG §37` allows fines up to **EUR 100,000** for certain violations, including offering or providing a service contrary to the regulation.
- `BFSG §3(3)` contains an exemption for **microenterprises providing services**. Do not assume the exemption applies. Treat compliance as required unless Legal confirms otherwise.
- `BFSGV §3` requires the **state of the art** to be observed.

Engineering interpretation:

- For this app, the minimum target is **WCAG 2.1 AA**.
- The operational target should be **WCAG 2.2 AA**, because W3C states WCAG 2.2 content remains backward-compatible with WCAG 2.1.
- BFSG is not satisfied by a one-time scan. You need accessible implementation, testing, evidence, and change control.

## Audit scope

Audit date: 2026-05-06

Repository scope reviewed:

- `apps/frontend`
- root and frontend agent rules
- route inventory under `apps/frontend/src/app`
- shared UI primitives, overlays, inputs, tables, header/footer
- existing `apps/frontend/lighthousereport.txt`

Surface size observed:

- `47` route files under `apps/frontend/src/app/**/page.tsx`

Audit method used:

1. Repo-wide static inspection of layouts, inputs, dialogs, tables, navigation, and media.
2. Pattern scans for ARIA, labels, `target="_blank"`, dialog usage, headings, tables, focus styles, and motion.
3. Review of existing Lighthouse snapshot for `/appointments`.
4. Spot inspection of representative high-risk files.

This is a deep code audit, not a claim of final conformance. A complete compliance program still requires browser-based keyboard, screen-reader, zoom/reflow, contrast, and transaction-flow validation.

## Executive assessment

Current state: **not ready to claim BFSG-grade compliance**.

The codebase already has some good foundations:

- `apps/frontend/src/app/layout.tsx` sets `lang="en"`.
- `apps/frontend/src/app/ui/overlays/Modal/ModalBase.tsx` has reasonable focus-trap and escape handling.
- some dialogs and buttons already use accessible names.
- Storybook a11y addon is installed.

But there are still systemic blockers:

- inconsistent semantic structure across the app
- unlabeled or placeholder-driven form controls
- focus styling removed in multiple places
- custom dialogs that bypass the shared modal primitive
- decorative images with conflicting semantics
- incomplete table semantics
- no visible evidence of automated accessibility testing in CI
- no apparent BFSG service accessibility statement / conformance disclosure

If this app serves German consumers in e-commerce, payments, or onboarding flows, it should be treated as **high risk** until the gaps below are closed.

## Repo-specific findings

### 1. No platform-level accessibility entrypoint

Observed:

- `apps/frontend/src/app/layout.tsx:41` sets `lang="en"`, which is good.
- The root layout does **not** expose an obvious global skip link or consistent main-content anchor.
- Route-level scans found very few explicit `<main>` landmarks and very few `<h1>` usages relative to the number of routes.

Risk:

- WCAG 2.1 SC 2.4.1 Bypass Blocks
- SC 1.3.1 Info and Relationships
- SC 2.4.6 Headings and Labels

Impact:

- keyboard and screen-reader users may need to traverse repeated nav/header content on every route
- page structure is likely inconsistent across authenticated and public surfaces

### 2. Labeling and accessible-name debt in shared inputs

Observed:

- `apps/frontend/src/app/ui/inputs/Search/index.tsx:16-23` renders an input with placeholder text but no associated label, `aria-label`, or `aria-labelledby`.
- `apps/frontend/src/app/ui/inputs/FormInput/FormInput.tsx:47-88` has a floating label pattern, but the wider codebase still contains many placeholder-driven inputs discovered by scan.
- Existing Lighthouse data includes failures for `color-contrast` and `label-content-name-mismatch`.

Risk:

- SC 1.3.1
- SC 2.5.3 Label in Name
- SC 3.3.2 Labels or Instructions
- SC 4.1.2 Name, Role, Value

Impact:

- users of screen readers, voice control, and cognitive support tools may not get stable field identification
- search, auth, payment, and settings fields are at elevated risk

### 3. Focus visibility is not trustworthy

Observed:

- `apps/frontend/src/app/globals.css:26-33` sets `scroll-behavior: smooth` globally.
- `outline: none` and `outline-none` patterns appear in many CSS and TSX files across inputs, dropdowns, widgets, onboarding, and marketing surfaces.
- Some places add `focus-visible:ring-*`; many others do not.

Risk:

- SC 2.4.7 Focus Visible
- SC 2.3.3 / motion expectations
- potential usability regressions for keyboard users

Impact:

- keyboard focus may be invisible or weak on critical controls
- smooth scrolling and motion can cause problems for vestibular or cognitive users when not reduced

### 4. Dialog implementation is inconsistent

Observed:

- `apps/frontend/src/app/ui/overlays/Modal/ModalBase.tsx:53-145` is a good base primitive.
- `apps/frontend/src/app/ui/overlays/CalBookingOverlay.tsx:27-53` creates a raw dialog instead of using `ModalBase`.
- repo scan found additional direct `<dialog>` usage in feature pages and overlays.

Risk:

- SC 2.1.1 Keyboard
- SC 2.4.3 Focus Order
- SC 4.1.2 Name, Role, Value

Impact:

- focus restoration, escape behavior, outside-click handling, inert background behavior, and accessible naming may drift per implementation
- payment/order overlays and embedded flows are especially sensitive

### 5. Decorative and informative image handling is inconsistent

Observed:

- `apps/frontend/src/app/ui/widgets/Footer/Footer.tsx:135-176` uses `aria-hidden` on images that still have meaningful `alt` text.
- `apps/frontend/src/app/ui/widgets/UploadImage/LogoUploader.tsx:88-114` uses raw `<img>`, hidden file input patterns, and clickable labels/buttons that need consistent naming and state announcements.
- multiple marketing components use `Image aria-hidden` with non-empty `alt`.

Risk:

- SC 1.1.1 Non-text Content
- SC 4.1.2

Impact:

- screen readers may get conflicting or redundant signals
- upload/edit image flows may not expose state changes clearly

### 6. Table semantics are too thin for a compliance claim

Observed:

- `apps/frontend/src/app/ui/tables/GenericTable/GenericTable.tsx:127-183` renders data tables with headers, but no `<caption>`, no `scope`, no sort semantics, no row-header strategy, and no accessible pagination narration.
- legal pages contain repeated table patterns with hidden `<thead>` sections and legacy structure, for example `apps/frontend/src/app/features/legal/pages/TermsAndConditions.tsx:1125-1160`.

Risk:

- SC 1.3.1
- SC 2.4.6
- SC 4.1.2

Impact:

- screen-reader table navigation may be ambiguous, especially in dense operational data and legal content

### 7. External links and legal content have consistency problems

Observed:

- `apps/frontend/src/app/ui/widgets/Footer/Footer.tsx:202-205` uses `target="_blank"` conditionally without consistently setting `rel`.
- `apps/frontend/src/app/features/legal/pages/TermsAndConditions.tsx:1041-1043` has `_blank` without `rel`.

Risk:

- not the highest accessibility failure by itself, but indicates inconsistent handling on public/legal surfaces
- links opening new contexts should be intentional and communicated consistently

### 8. Motion, auto-scroll, and animation need a reduced-motion policy

Observed:

- broad use of transitions and animations in CSS
- no repo-wide evidence of `prefers-reduced-motion` handling in the scan
- global `scroll-behavior: smooth`

Risk:

- WCAG 2.1 does not require all motion to disappear, but production-grade accessibility demands a clear reduced-motion path
- future WCAG 2.2-oriented quality expectations will judge this harshly

### 9. Accessibility testing is not institutionalized

Observed:

- Storybook addon exists: `@storybook/addon-a11y`
- existing Lighthouse snapshot exists for one route: `apps/frontend/lighthousereport.txt`
- repo scan did not show evidence of `jest-axe`, `@axe-core/playwright`, or a route coverage matrix in CI

Risk:

- no credible way to prevent regression
- no defensible audit evidence for BFSG response, internal signoff, or customer questionnaires

## Priority order

Do not start with page-by-page fixes.

Use this order:

1. platform and governance baseline
2. shared primitives
3. high-risk transactional routes
4. app-wide route remediation
5. automated testing and audit evidence
6. legal/compliance disclosures

## End-to-end remediation plan

### Phase 0: Compliance framing and freeze rules

Goal:

- stop introducing new accessibility debt while remediation is underway

Actions:

1. Define the program target as:
   - legal floor: `WCAG 2.1 AA`
   - engineering target: `WCAG 2.2 AA`
2. Mark all new frontend PRs as requiring:
   - keyboard support
   - visible focus
   - semantic labels
   - screen-reader naming
   - no new raw dialogs unless approved
3. Create an accessibility decision log:
   - exceptions
   - third-party blockers
   - legal interpretations
   - unresolved vendor issues
4. Confirm whether the business is a BFSG-covered service provider and whether any microenterprise exemption is being claimed. This is a Legal/Compliance decision, not an engineering assumption.

Done when:

- target standard is written down
- exception process exists
- future agents are told not to ship new inaccessible primitives

### Phase 1: Platform foundation

Goal:

- make the shell accessible before touching leaf pages

Actions:

1. Add a global skip link in root layout.
2. Add a consistent main-content anchor and guarantee one `<main>` landmark per route.
3. Standardize page titles, `h1` ownership, and route heading hierarchy.
4. Remove global accessibility-hostile defaults:
   - global smooth scrolling unless reduced-motion aware
   - naked `outline: none` without replacement
5. Add `prefers-reduced-motion` policy for:
   - framer-motion components
   - loaders
   - carousels
   - auto-scroll behavior
6. Establish a shared screen-reader utility pattern:
   - visually hidden text helper
   - live region helper
   - status message helper

Done when:

- every route can be bypassed into main content
- focus is visibly trackable everywhere
- layout shell passes keyboard-only smoke checks

### Phase 2: Shared component remediation

Goal:

- fix the components that fan out across the entire app

Component groups to fix first:

1. Inputs
   - `ui/inputs/Search`
   - `FormInput`
   - `FormInputPass`
   - `Datepicker`
   - dropdown/search-dropdown variants
   - file upload widgets
2. Overlays
   - `ModalBase`
   - all raw dialog implementations migrated onto one contract
3. Navigation
   - header
   - sidebar
   - footer
   - tab/scope switchers
4. Tables
   - `GenericTable`
   - data tables
   - legal tables
5. Status and feedback
   - loaders
   - toasts
   - validation errors
   - async success/failure announcements

Implementation rules:

1. Every form field must have one stable accessible name.
2. Placeholder text must never be the only label.
3. Every icon-only button must have an accessible name.
4. Decorative images must use empty alt semantics, not contradictory `aria-hidden` plus meaningful alt text.
5. Dialogs must:
   - have a programmatic name
   - trap focus
   - restore focus
   - block background interaction
   - support escape when legally/functionally permitted
6. Tables must get:
   - caption when the table needs a visible/announced title
   - scoped headers
   - sortable semantics where applicable
   - accessible pagination copy

Done when:

- shared components are safe defaults
- future feature teams do not need ad hoc accessibility fixes for basic controls

### Phase 3: High-risk route remediation

Goal:

- fix the flows most likely to create BFSG exposure

Fix in this order:

1. public auth and onboarding
   - sign in
   - sign up
   - forgot password
   - create organization
   - team onboarding
2. payment and finance
   - payment status
   - finance
   - Stripe onboarding
   - invoice and payment actions
3. e-commerce-like and contractual flows
   - pricing
   - book demo / booking overlay
   - trust center
   - legal pages
4. authenticated operational core
   - appointments
   - tasks
   - companions
   - forms
   - inventory
   - organization/settings
5. integrations and embedded experiences
   - Merck manuals
   - IDEXX workspace
   - developer portal

Per-route checklist:

1. Page has exactly one main landmark.
2. Page has one clear `h1`.
3. Tab order matches visual/task order.
4. Every interactive control has:
   - semantic element
   - visible label or text
   - accessible name
   - visible focus
   - disabled state where relevant
5. All error states are programmatically associated with their fields.
6. Async status updates are announced.
7. No keyboard trap except intended modal/dialog trap.
8. Reflow works at 320 CSS px width.
9. Zoom works at 200 percent without loss of content/function.
10. Color is not the only carrier of state.

Done when:

- critical flows can be completed with keyboard and screen reader
- route audits are documented individually

### Phase 4: Testing and evidence

Goal:

- make accessibility enforceable in CI and review

Required additions:

1. Unit/component tests
   - add `jest-axe`
   - add assertions for accessible names, roles, focus movement, error association
2. E2E tests
   - add Playwright keyboard journeys for auth, onboarding, finance, booking, legal/contact flows
   - add axe checks for route templates and modal states
3. Visual/manual checks
   - 320px reflow
   - 200% zoom
   - reduced motion
   - dark/light if applicable
4. Screen-reader verification matrix
   - VoiceOver + Safari on macOS
   - NVDA + Chrome on Windows if available in the organization
5. Lighthouse and axe reporting
   - do not rely on one route snapshot
   - produce per-template evidence

Done when:

- CI fails on serious a11y regression
- there is reproducible evidence for the main templates and flows

### Phase 5: BFSG operational compliance

Goal:

- close the non-code obligations that make the engineering work auditable

Required outputs:

1. Accessibility statement / service accessibility disclosure aligned to `BFSG Anlage 3`
2. location in app or public site where the disclosure is clearly perceivable
3. process for reporting accessibility issues
4. named owner for remediation SLA
5. documented market surveillance authority details if applicable
6. documented exception records for:
   - disproportionate burden
   - fundamental alteration
   - third-party blockers

Done when:

- the organization can answer a compliance inquiry with evidence, not opinion

## Concrete tasks for future agents

Use these tasks in order. Do not skip ahead.

### Task 1: Build the accessibility foundation

Deliverables:

- skip link
- consistent `<main>` landmark strategy
- reduced-motion policy
- focus-visible system
- shared visually-hidden utility
- shared live-region helper

Validation:

- keyboard smoke test on public layout and authenticated layout
- targeted tests for touched primitives

### Task 2: Fix shared form controls

Deliverables:

- accessible names for search, dropdown, date, password, file upload, and custom input primitives
- error message association via `aria-describedby`
- no placeholder-only labeling

Validation:

- `jest-axe`
- RTL interaction tests
- manual keyboard traversal

### Task 3: Normalize dialogs and overlays

Deliverables:

- all dialogs routed through one approved primitive or one strict contract
- accessible names, focus trap, focus return, inert background behavior, escape/close consistency

Validation:

- Playwright keyboard modal tests
- screen-reader spot checks

### Task 4: Fix tables and data-heavy surfaces

Deliverables:

- semantic table headers
- captions where needed
- pagination semantics
- sortable column semantics if sorting exists

Validation:

- screen-reader table navigation checks
- targeted tests for table primitives

### Task 5: Remediate high-risk routes

Deliverables:

- auth
- onboarding
- finance/payment
- booking
- legal/trust center
- appointments/tasks

Validation:

- per-route axe checks
- per-route keyboard scripts
- zoom and reflow checks

### Task 6: Add CI enforcement

Deliverables:

- `jest-axe`
- Playwright accessibility suite
- route-template Lighthouse or axe reporting
- PR checklist updates

Validation:

- failing test demonstrates real regression protection

### Task 7: Publish the BFSG disclosure artifacts

Deliverables:

- accessibility statement / conformance disclosure
- support contact and reporting mechanism
- internal compliance evidence folder

Validation:

- legal/compliance review

## Acceptance criteria for “ready to claim compliance”

Do not claim the app is compliant until all of the following are true:

1. All covered consumer-facing flows meet the internal WCAG checklist.
2. Shared primitives are accessibility-safe by default.
3. Keyboard-only users can complete auth, onboarding, booking, payment, and core app tasks.
4. Screen-reader smoke tests pass on the supported browser matrix.
5. Reflow and zoom checks pass on critical routes.
6. Color contrast issues are resolved and re-tested.
7. Automated accessibility tests run in CI.
8. Accessibility disclosure required by BFSG service obligations is published.
9. Any exception or third-party blocker is documented and legally reviewed.

## Recommended engineering standard

For this repo, adopt this internal rule:

- ship to **WCAG 2.2 AA** standard
- verify against **WCAG 2.1 AA** legal floor

Reason:

- it is the safer long-term target
- it reduces future rework
- W3C states WCAG 2.2 content remains backward-compatible with WCAG 2.1

## Suggested implementation backlog

Suggested epic order:

1. `feat(frontend): add global accessibility shell primitives`
2. `fix(frontend): remediate shared form controls for accessible names and errors`
3. `fix(frontend): standardize modal and overlay accessibility behavior`
4. `fix(frontend): improve table semantics and pagination accessibility`
5. `fix(frontend): remediate auth and onboarding flows for WCAG AA`
6. `fix(frontend): remediate finance and payment surfaces for BFSG`
7. `fix(frontend): remediate appointments and task workflows for keyboard and screen reader use`
8. `test(frontend): add automated accessibility coverage in jest and playwright`
9. `docs(frontend): publish BFSG accessibility disclosure and audit evidence`

## Suggested prompt for the next agent

Use this prompt verbatim or with minor edits:

> Read `AGENTS.md`, `apps/frontend/AGENTS.md`, and `docs/accessibility/frontend-bfsg-wcag-audit-plan.md`. Implement **Phase 1 only** from the accessibility plan. Make the smallest safe code changes inside `apps/frontend`. Add or update targeted tests for every touched file. Before finishing, run from `apps/frontend`: `npx tsc --noemit` with a 120s timeout, `pnpm --filter frontend run lint`, and targeted tests for all touched files. Report exact results and propose a COMMIT CHECKPOINT message.

## Sources

- BFSG `§1`, `§3`, `§17`, `§37`, `Anlage 3`: https://www.gesetze-im-internet.de/bfsg/
- BFSGV `§3`, `§19`: https://www.gesetze-im-internet.de/bfsgv/
- EU Directive 2019/882 summary: https://eur-lex.europa.eu/legal-content/en/LSU/?uri=CELEX%3A32019L0882
- W3C WCAG overview: https://www.w3.org/WAI/standards-guidelines/wcag/
- W3C WCAG 2 Level AA conformance: https://www.w3.org/WAI/WCAG2AA-Conformance
