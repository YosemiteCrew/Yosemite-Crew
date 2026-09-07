# PIMS UI audit

## Implemented and verified locally

- Finance uses shared status filters, a compact laptop ledger, and readable full invoice references on both table and phone-card layouts.
- Inventory has one primary catalogue with compact low-stock and expiry summaries; the controlled-drug register remains a separate legal workflow.
- Phone content reserves space for the floating creation action and tab bar.
- Appointment waitlist, organization specialties, federation card surfaces, forms service labels, and dark Storybook stories were reviewed.
- Appointment Board is retained as the status/lifecycle workboard (phone columns scroll intentionally); the separate Check-in board accordion was removed as duplicate navigation.
- Coming-soon integrations no longer present an inert “Notify me” pseudo-button; interest notifications remain intentionally unwired.
- Controlled-drug read, record, and correction permissions are explicit; the phone register now keeps every audit-critical field visible in a card layout.

## Evidence

- All changed front-end tests: 25 suites / 546 tests passed in one final run.
- Final InvoiceTable suite: 20 tests passed; lint, type-check, diff check, and Aikido scan passed.
- InvoiceCard and InvoiceTable suites: 26 tests passed; the new phone-card reference assertion failed under deliberate mutation; light 390px cards visibly show the full references with no overflow.
- Backend controlled-register authorization suite: 6 tests passed.
- Controlled-register UI/page suites: 24 tests passed; the phone balance assertion failed under deliberate mutation. Its 375px dark and light layouts show all audit-critical fields without horizontal scrolling.
- The 390px Inventory phone catalog was visually confirmed in light and dark themes: one filterable catalog of stock-health cards, with no horizontal overflow.
- The 390px Finance phone list was visually confirmed in light and dark themes with invoice references visible and no document overflow. Its seven-status filter rail is intentionally an inner horizontal scroller; its Storybook callback is a static-fixture spy, so it does not change the fixture when clicked.
- At 390px dark, Appointment Board has no duplicate Check-in Board navigation and no document overflow; its lifecycle columns deliberately scroll inside the Board. The Waitlist fits at the same width and exposes each permitted Offer, Book appointment, and Cancel action.
- At 390px dark, Federation settings and the reorganized Specialities surface have no document overflow. Federation’s read-only visible controls were inspected; referrals, broadcasts, follows, and directory changes remained deliberately unexercised.
- At 390px dark, Forms preserves labels and no-overflow layout, while Integrations stacks cleanly and coming-soon cards contain no inert notification action.
- Finance phone-list Storybook was corrected to pass its required KPI currency. Before the repair its KPI labels read `undefined 114.00`; at 390px dark they now render `$114.00` and `$490.00` with no overflow. Its component suite (13 tests) and fixture lint pass.
- LabTests phone Storybook no longer overflows its canvas: the fixture now uses the available canvas width up to 375px (360px within Storybook padding). Its disclosure and create-order action now have distinct accessible names. The Accordion and LabTests suites passed (71 tests); the new toggle-name assertion failed under deliberate mutation. Browser verification confirms the two names and zero document overflow.
- Inventory Add Product Storybook’s Basic Details assertion now uses the rendered “New product” title. Browser workflow verification completed all six gated stages through Vendor details with real selections and validation state, stopping before Save; no product was submitted.
- Appointment creation’s submit-validation state was checked at 390px dark: field errors remain visible beside their controls and the document does not overflow. The final Book appointment action was not invoked because it would notify the client.
- Tasks Board was checked locally at 390px dark. The document does not overflow; its multi-column lane is intentionally an inner horizontal scroller.
- Organization’s permission matrix was checked at 390px dark. The explicit Controlled drug register row remains visible without document overflow; no member permissions were changed.
- Chat’s long-name phone header was checked at 390px dark: title truncation contains the header within the viewport and Back/Search/Info/Close controls are exposed. No message or session-changing action was sent.
- Dashboard’s phone fixture was checked in light and dark at 390px without overflow. Stripe and team-invite onboarding actions were not invoked.
- Companions directory was checked at 390px dark with no overflow. Its list filters and record actions are exposed; no companion, task, appointment, or status write was attempted.
- Integrations suite: 43 tests passed; the new no-inert-CTA assertion failed under deliberate mutation.
- Focused lint passed for every changed production front-end and backend file; front-end and backend type checks completed before their respective full lint runs. `git diff --check` passed.
- Production-file Aikido scans returned no issues, including a final five-file scan of the controlled-register permissions/router and final UI changes.
- Storybook visual review covered finance filters and invoices, inventory alerts, waitlist, specialties, federation, task fixtures, and templates in dark mode; selected changed Inventory, Appointments, and Finance surfaces were also reviewed in light mode. Invoice cards, task cards, the template editor, and specialty cards were checked at phone widths with no horizontal overflow.

## Live deployment blockers

- The live audit was switched to **Avenger Park, Avondale FC**. Dashboard, Appointments, Tasks, Chat, Companions, Forms, Finance, Inventory, Controlled drugs, Organization, and Integrations load in that organisation without document-level horizontal overflow at the desktop audit viewport.
- `/settings` and `/network` initially render their authenticated shell, then redirect the active Avenger Park session to `/signin` after loading. This was reproduced after a fresh route sweep; no user credentials were entered or recovery flow initiated.
- The deployed appointments page still exposes the redundant Check-in board accordion; the local source removes it.
- The deployed Inventory landing page still renders every low-stock and expiring batch as two competing long panels (21 and 51 rows in the inspected organisation). The branch bounds each to three alert previews and links both to the one primary catalog.
- The deployed finance ledger remains behind the local responsive table work.

## Route and workflow coverage

- Direct visual and safe interaction review: Dashboard, Appointments, Finance (invoices, estimates, discounts, insurance), Inventory, Controlled drug register, Organization, Settings/Federation, Forms, Integrations, Companions, Network, and Storybook fixtures for changed components.
- Source and automated-state review: Tasks (live session redirected to sign-in), appointment workspaces, public booking/onboarding, developers portal, and organization speciality management.
- Federation management routes are backend permission-gated with `integrations:view:any` or `integrations:edit:any`; their side-effecting actions were not exercised.
- Static source sweep found no active `TODO`, `FIXME`, stub, dummy, or unimplemented feature workflow. The two matched comments document an intentional unsupported-route fallback and a Storybook fixture.
- A full Storybook interaction run completed non-green. Its observed failures include adjacent fixture/runner failures in marketing, companions, inventory, and organization, and it revealed the LabTests overflow/accessibility issues fixed above. It is not represented as a passing gate.

## Deliberate safety exclusions

No Stripe payments, organization/user deletions, external notifications, follows, referrals, broadcasts, clinical record creation, or fabricated controlled-drug entries were exercised.
