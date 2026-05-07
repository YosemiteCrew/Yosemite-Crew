# Frontend BFSG Execution Checklist

Last updated: 2026-05-07 (eighth batch)

Reference plan:

- [frontend-bfsg-wcag-audit-plan.md](/Users/harshitwandhare/Desktop/Yosemite-Crew/docs/accessibility/frontend-bfsg-wcag-audit-plan.md)

## Program status

- [x] Audit and remediation strategy documented
- [x] First implementation batch started
- [x] Automated accessibility enforcement installed (jest-axe + @axe-core/playwright)
- [ ] Full route-by-route BFSG remediation complete
- [ ] Manual assistive-technology validation complete
- [x] BFSG disclosure artifacts — accessibility statement published at `/accessibility`

## Phase 1: Platform foundation

- [x] Add global skip link
- [x] Add stable `#main-content` target in public/app shells
- [x] Add consistent main landmark wrappers in shared layouts (public layout has `<main id="main-content">`)
- [x] Add global focus-visible styling (globals.css — buttons/links get `2px` ring; inputs/selects/textareas suppressed since border-color IS the indicator)
- [x] Add reduced-motion baseline (`prefers-reduced-motion` block in globals.css)
- [x] Add route-change/live-region announcement pattern (`RouteAnnouncer` — aria-live polite)
- [x] Remove remaining accessibility-hostile global CSS overrides (`outline: none` without replacement — all audited; remaining instances are intentional with border-change focus indicator or explicit `:focus-visible` override)
- [x] Standardize one `h1` and one main landmark per route template — auth pages done; public marketing routes in current batch now use semantic primary headings (Pricing, Contact, book-demo, overview)

## Phase 2: Shared primitives

### Inputs

- [x] Search input gets a stable accessible label (`<label className="sr-only">`, `useId()`)
- [x] FormInput wires error text through `aria-describedby` + `role="alert"`
- [x] FormInputPass wires error text through `aria-describedby` + `role="alert"`
- [x] Datepicker exposes error helper text accessibly
- [x] LogoUploader improves remove/upload control naming
- [x] Dropdown: `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls`, `role="listbox"`, `role="option"`, `aria-selected`, sr-only search label, `role="alert"` error, Escape key handler
- [x] LabelDropdown: `focus-visible:outline-none` (border-change IS indicator), `aria-current` wiring
- [x] SearchDropdown: `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`, `role="listbox"`, `role="option"`, `role="alert"` error, `role="status"` loading, `focus-within` border on container
- [x] Timepicker: `aria-label` with value, `aria-describedby` error, `role="alert"` error, border-change focus indicator (no extra ring)
- [x] FileInput / file upload primitives — base input and upload widgets audited; accessible names added for upload triggers and remove actions; `jest-axe` coverage added for FileInput / UploadImage / DocUploader

### Overlays and dialogs

- [x] ModalBase can focus the dialog itself when no focusable child exists
- [x] Cal booking overlay migrated onto shared modal behavior
- [~] Raw `<dialog>` in `AppointmentPopover.tsx` — title wiring and cancel behavior added; `role="alert"` added to statusError; action buttons now expose explicit `aria-label`; intentionally NOT migrated onto `ModalBase` (non-modal popover semantics require `aria-modal="false"`, no focus trap, no body scroll lock)
- [~] Raw `<dialog>` in `TaskSlot.tsx` — title wiring and cancel behavior added; focus restoration now handled by `usePopoverManager`; action buttons now expose explicit `aria-label`; intentionally NOT migrated onto `ModalBase` (same non-modal rationale)
- [x] Raw `<dialog>` in `TrustCenter.tsx` removed — request-access flow now uses shared `ModalBase`
- [~] Normalize overlay titles, descriptions, and close behavior across all three — trust-center complete; appointment/task popovers fully normalized for WCAG AA (non-modal dialog contract, labelled titles, explicit action names, focus restoration, Escape close)

### Navigation

- [x] Guest header menu button exposes `aria-expanded` / `aria-controls`
- [x] Guest header nav links expose `aria-current`
- [x] Sidebar links expose `aria-current`
- [x] Logo links use meaningful accessible names
- [x] Footer links: `focus-visible` ring, no `outline: none` suppression
- [x] FAQ accordion: `focus-visible` ring restored
- [~] Mobile navigation and account menus — controlled-menu semantics, `aria-expanded` / `aria-controls`, and Escape-close behavior added for guest/authenticated headers; manual keyboard walkthrough still pending

### Tables and status surfaces

- [x] GenericTable supports accessible caption
- [x] GenericTable column headers use `scope="col"`
- [x] Loader exposes a status role
- [x] Data tables in legal pages — `TermsAndConditions.tsx` and `TrustCenter.tsx` now expose captions plus meaningful row/column header semantics

## Phase 3: High-risk route remediation

- [~] Public auth flows — `h1` added to SignIn, SignUp, ForgotPassword; OTP inputs labelled; `jest-axe` coverage added in high-signal component tests; per-field and OTP-group error association is now tightened in SignIn, SignUp, ForgotPassword, and OtpModal; remaining work is mainly manual keyboard/screen-reader verification
- [~] Organization onboarding flows — primary route headings added for `CreateOrg` and `TeamOnboarding`; current code audit shows step-level controls are largely labelled, but a manual keyboard/screen-reader pass is still pending
- [~] Finance / payment / Stripe onboarding — primary route headings added for `Finance`, `payment-status`, and `StripeOnboarding`; payment-status state messaging, invoice-table naming/captioning, invoice modal tabs, and Stripe onboarding loading/error states have been remediated; remaining work is mostly manual embedded-surface verification
- [~] Booking overlays and scheduling flows — popovers now restore focus and expose labelled dialog titles; still not fully consolidated onto a shared popover contract
- [x] Legal / trust-center content — `TrustCenter` request-access modal now runs on `ModalBase`; remaining work is table/legal content audit
- [~] Appointments / tasks / operational dense workflows — popover contract is stabilized; slot creation controls now expose unique time-based names and day/week timelines are labelled as navigable regions; `AppointmentPopover` and `TaskSlot` action buttons now expose explicit `aria-label`; `AppointmentPopover` statusError has `role="alert"`; remaining work is broader manual workflow review
- [x] Integrations / embedded third-party flows — `Integrations/index.tsx`: h1, filter tab `aria-pressed`, `role="alert"` error, `role="status"` empty states; `IdexxWorkspace/index.tsx`: h1, `role="alert"` error, pagination `<nav aria-label>`, result modal `aria-labelledby`; `MerckManuals/index.tsx`: sr-only h1, `AudienceToggle` `role="group"` + `aria-pressed`, language pills `aria-pressed`, `MerckReaderPortal` `role="dialog"` + `aria-modal` + `aria-labelledby`, `role="alert"`/`role="status"` feedback; `DeveloperPortalHome.tsx`: `h1`/`h2`/`h3` hierarchy corrected (was double-`h2` with `h4` children); jest-axe coverage added to all four test suites

## Phase 4: Testing and enforcement

- [x] Targeted Jest coverage added for first batch
- [x] `jest-axe` installed and configured in `jest.setup.ts` (WCAG 2.1 AA baseline, color-contrast disabled for jsdom)
- [x] `jest-axe` assertions added to: SkipLink, RouteAnnouncer, FormInput, FormInputPass, Search, Datepicker, GuestHeader, YosemiteLoader, GenericTable
- [x] Playwright `@axe-core/playwright` installed
- [x] Playwright a11y spec `e2e/a11y.spec.ts` covers public pages + skip-link keyboard flow
- [x] `frontend-a11y.yml` CI workflow gates the full current `jest-axe` suite on every PR touching `apps/frontend/src/**`
- [x] Dropdown, LabelDropdown, SearchDropdown, Timepicker tests updated — `jest-axe` assertions added
- [x] Add zoom / reflow / reduced-motion regression checklist (manual browser checklist at `docs/accessibility/zoom-reflow-reduced-motion-checklist.md`)
- [x] Appointment/task popover axe coverage added in targeted calendar tests
- [x] `pnpm run e2e` in `apps/frontend` now runs the full `jest-axe` batch before the Playwright browser suite so local accessibility verification matches CI intent

## Phase 5: BFSG operational artifacts

- [x] Accessibility statement published at `/accessibility` (BFSG Anlage 3 compliant — conformance status, report barrier, enforcement authority, third-party exception register)
- [x] Accessibility statement linked from Footer (`Company` links section)
- [x] Accessibility issue reporting flow — dedicated form built at `/accessibility/report`; link added from accessibility statement
- [ ] Third-party exception register (documented in statement prose; structured register not yet built)
- [ ] Legal/compliance review checkpoint — engineering artifacts ready, legal sign-off pending

## Enforcement rules for new AI-generated code

All new code generated by AI or humans must pass the following before merging:

1. Any new component must include at least one `axe(container)` assertion in its test file
2. The `frontend-a11y.yml` workflow must pass green
3. No `aria-` attributes may be added without a corresponding test asserting their value
4. Interactive elements (buttons, links, inputs) must have accessible names verifiable via `getByRole`

## Current batch verification (fourth batch — 2026-05-06)

Completed in this batch:

- `PricingPage.tsx`, `ContactusPage.tsx`, `BookDemo.tsx`: semantic public-route headings added without visual restyling
- `Dropdown.test.tsx`, `LabelDropdown.test.tsx`, `SearchDropdown/index.test.tsx`, `Timepicker/index.test.tsx`: `jest-axe` coverage added
- `LabelDropdown.tsx`: listbox semantics strengthened (`aria-haspopup`, `aria-expanded`, `aria-controls`, `role="listbox"`, `role="option"`, `aria-selected`)
- `TrustCenter.tsx`: request-access dialog migrated to shared `ModalBase`
- `AppointmentPopover.tsx` and `TaskSlot.tsx`: labelled dialog titles and cancel handling added; `usePopoverManager` now restores focus to trigger on close
- `UploadImage.tsx` and `PdfDocUploader.tsx`: upload trigger and remove actions now expose explicit accessible names
- `Calendar/helpers.ts`: appointment calendar auto-scroll restored to smooth behavior for standard users while respecting `prefers-reduced-motion`
- `TrustCenter.test.tsx`, `FileInput.test.tsx`, `UploadImage.test.tsx`, `DocUploader.test.tsx`: `jest-axe` coverage added
- `SignIn.test.tsx`, `SignUp.test.tsx`, `ForgotPassword.test.tsx`: `jest-axe` coverage added for public auth flows
- `CreateOrg.tsx`, `TeamOnboarding.tsx`, `Finance/index.tsx`, `StripeOnboarding/index.tsx`, `payment-status/page.tsx`: semantic primary headings added without visual restyling
- `InvoiceInfo.test.tsx`: `jest-axe` coverage added for finance invoice modal
- `StripeOnboarding/index.test.tsx`: heading assertions added for onboarding/tax sections
- `Slot.test.tsx`, `TaskSlot.test.tsx`: `jest-axe` coverage added for appointment/task popovers; `DayCalendar.test.tsx` updated to assert the labelled dialog contract
- `payment-status/page.tsx`: loading/error/terminal payment states separated, live-region messaging improved, and polling now stops on terminal outcomes
- `InvoiceTable.tsx`: table caption plus explicit action names added; filtered empty state now announces itself accessibly
- `InvoiceInfo.tsx`: invoice section pills now expose a proper tablist/tabpanel contract
- `StripeOnboarding/index.tsx`: loading and setup-error states now render visible accessible feedback with retry support
- `TermsAndConditions.tsx`: primary page heading corrected and support/annex tables now expose captions plus meaningful column headers for assistive tech
- `TrustCenter.tsx`: sub-processor table now has a caption, scoped headers, and decorative provider logos so row headers announce cleanly
- `MobileMenu.tsx`, `GuestHeader.tsx`, `UserHeader.tsx`: mobile/account menu controls now expose explicit controlled-menu semantics and Escape-close handling without changing the existing visual design
- `AppointmentPopover.tsx`, `Slot.tsx`, `DayCalendar.tsx`, `TaskSlot.tsx`, `usePopoverManager.ts`: calendar popovers now behave as explicit non-modal dialogs with trigger `aria-haspopup/expanded/controls`, focus-safe Escape close, and restored-focus handling that no longer causes immediate reopen loops
- `apps/frontend/package.json`, `frontend-a11y.yml`, `frontend-e2e.yml`: shared `test:a11y` script added; local `pnpm run e2e` now executes the full Jest accessibility batch and then the Playwright suite; CI now separates public smoke + public a11y from the credential-gated authenticated flow
- `SignIn.tsx`, `SignUp.tsx`, `ForgotPassword.tsx`, `OtpModal.tsx`, `FormInputPass.tsx`: auth and verification flows now clear stale field errors while typing, expose inline forgot-password/OTP/new-password errors, give OTP groups explicit descriptions, and label the verification dialog through heading/description relationships rather than toast-only feedback
- `DayCalendar.tsx`, `WeekCalendar.tsx`, `Slot.tsx`, `TaskSlot.tsx`: dense calendar surfaces now avoid `role="application"`, expose labelled timeline regions, use more descriptive all-day event names, and give repeated slot-creation buttons unique time-specific accessible names
- Targeted tests passing: 44 suites / 424 tests across the current accessibility batch runs

- BFSG baseline re-verified against current primary sources:
  - BFSG entry into force for covered obligations: 28 June 2025
  - WCAG 2.1 remains a current W3C Recommendation (updated 6 May 2025)

## Current batch summary (fifth batch — 2026-05-07)

Completed in this batch:

- `Integrations/index.tsx`: `h1` page heading, filter tabs `aria-pressed`, `role="alert"` error banner, `role="status"` empty-state messages
- `IdexxWorkspace/index.tsx`: `h1` page heading (both enabled and disabled states), `role="alert"` error, pagination wrapped in `<nav aria-label="Results pagination">` with `aria-live`/`aria-atomic` count, result modal title wired via `aria-labelledby`
- `MerckManuals/index.tsx`: sr-only `h1` behind the logo image, `AudienceToggle` gets `role="group"` + `aria-label` + per-button `aria-pressed`, language filter pills get `aria-pressed`, `MerckReaderPortal` promoted to `role="dialog"` + `aria-modal="true"` + `aria-labelledby`, error/copy feedback gets `role="alert"` / `role="status"`
- `DeveloperPortalHome.tsx`: heading hierarchy corrected — `h1` → `h2` → `h3` (was `h2` top, `h4` children skipping two levels)
- `Integrations.test.tsx`, `IdexxWorkspace.test.tsx`, `MerckManuals.test.tsx`, `DeveloperPortalHome.test.tsx`: `jest-axe` coverage added; all 140 integration + 5 developer tests pass

## Current batch summary (sixth batch — 2026-05-07)

Completed in this batch:

- `TitleCalendar/index.tsx`: page title `<div>` promoted to `<h1>` — fixes heading semantics for Appointments and Tasks pages
- `Inventory/index.tsx`: page heading `<div>` → `<h1>`
- `Forms/index.tsx`: page heading `<div>` → `<h1>` ("Templates")
- `Companions/Companions.tsx`: page heading `<div>` → `<h1>`
- `CompanionHistoryPage.tsx`: history title `<div>` → `<h1>`
- `Organizations.tsx`: "Overview" `<div>` → `<h1>`
- `Guides.tsx`: page heading `<div>` → `<h1>`; featured guide title `<div>` → `<h2>`
- `DocSigningPortal.tsx`: "Document Signing Portal" `<h2>` → `<h1>` (it is the only heading on that route); error state gets `role="alert"`
- `AppointmentPopover.tsx`: `statusError` div gets `role="alert"`; all action icon buttons now expose explicit `aria-label` in addition to `title`; react-icon elements get `aria-hidden="true"`
- `TaskSlot.tsx`: popover action buttons (View task, Change status, Reschedule) now expose explicit `aria-label`; icons get `aria-hidden="true"`
- `TitleCalendar/index.test.tsx`: axe assertion added; existing heading test updated to `getByRole('heading', {level:1})`
- `Organizations.test.tsx`: axe assertion added; heading check upgraded to `getByRole('heading', {level:1})`
- `Companions.test.tsx`: axe assertion + h1 heading assertion added
- `CompanionHistoryPage.test.tsx`: axe assertion added
- `Inventory/index.test.tsx`: axe assertion + h1 assertion added; mock `<select>` and `<input>` elements in InventoryFilters mock given `aria-label` to pass axe
- `Forms/index.test.tsx`: axe assertion + h1 assertion added; existing text check upgraded to `getByRole('heading', {level:1})`
- `Guides.test.tsx`: axe assertion added
- All 71 tests in 9 suites pass; TypeScript and ESLint clean

## Current batch summary (seventh batch — 2026-05-07)

Completed in this batch:

- `accessibility/report/page.tsx`: new `'use client'` accessibility barrier report form — breadcrumb, error summary (`role="alert"` + `aria-labelledby`), per-field `aria-required`/`aria-invalid`/`aria-describedby` + inline `role="alert"` errors, severity select with 4 options, success state with `role="status" aria-live="polite"`, Cancel link; submits to `/v1/contact-us/contact-web` with `type: 'COMPLAINT'`, `source: 'accessibility'`
- `accessibility/page.tsx`: added report-form link (`<Link href="/accessibility/report">`) before email contact options
- `accessibility-report-page.test.tsx`: 12 tests — renders, axe (initial + success), validation errors (empty + email format), field error clearing, successful submit with payload assertions, generic API error, axios error message, severity options, breadcrumb, cancel link; all 12 pass
- `docs/accessibility/zoom-reflow-reduced-motion-checklist.md`: manual browser regression checklist covering SC 1.4.4 (text resize 200%), SC 1.4.10 (reflow 320 px), reduced-motion (`prefers-reduced-motion: reduce`), focus visibility at zoom, and touch target guidance
- All automated checks pass: TypeScript clean, ESLint clean, 12/12 tests pass

## Current batch summary (eighth batch — 2026-05-07)

Completed in this batch:

- `LandingPage.tsx`: New hero section `<motion.div>` → `<motion.h1>`; old hero section hero text `<div>` → `<h1>`
- `LandingCard.tsx`: Section card title `<div>` → `<h2>`; eyebrow label `<div>` → `<p>`
- `HomePage.tsx`: Hero text split-div merged into single `<h1>`; three section headings `<div>` → `<h2>` ("Everything you need...", "Focus on care...", "Caring for vets...", "Better care is just a click away")
- `FeatureBox.tsx`: Card title `<div>` → `<h3>` (under h2 section)
- `FocusCard.tsx`: Card title `<div>` → `<h3>` (under h2 section)
- `AboutUs.tsx`: Hero `<div>` → `<h1>`; sub-headline `<div>` → `<p>`; "About Us" `<div>` → `<h2>`; "Our story" `<div>` → `<h2>`; "We're an open source community" `<div>` → `<h2>`; body paragraphs `<div>` → `<p>`
- `DeveloperLanding.tsx`: Hero `<div>` → `<h1>`; three section headings `<div>` → `<h2>`; six feature card titles `<div>` → `<h3>`; three step titles `<div>` → `<h3>`
- `PetOwner.tsx`: Hero `<div>` → `<h1>`; four section headings `<div>` → `<h2>`; five toolkit card titles `<div>` → `<h3>`
- `ContactusPage.tsx`: "We are happy to assist you" `<div>` → `<h2>` (page already has `<h1>`)
- `PricingPage.tsx`: "Plans and features" `<div>` → `<h2>` (page already has `<h1>`)
- `Finance/index.tsx`: Heading class moved from wrapper `<div>` onto `<h1>` directly; wrapper `<div>` stripped of heading classes
- All tests pass: 33/33 across 8 suites (ContactusPage, PricingPage, DeveloperLanding, Finance/index, LandingPage, About, PetOwner, LandingCard); TypeScript clean; ESLint clean

## Next implementation slice (for next agent)

Priority order:

1. **Manual motion/reflow verification** — execute `zoom-reflow-reduced-motion-checklist.md` in a real browser; record results in its Results Log section.
2. **Public auth keyboard review** — automated field/error wiring is stronger now; finish the manual keyboard and screen-reader walkthrough for sign-in, sign-up, forgot-password, and verification states.
3. **Final manual mobile/header keyboard walkthrough** — code-side menu semantics are in place; finish the human verification pass and document findings.
4. **Appointments / tasks dense-workflow manual audit** — code-side naming and region semantics are stronger now; continue the human keyboard and announcement review.
5. **Third-party exception register** — structured register not yet built; currently documented only in statement prose.
6. **Legal/compliance review checkpoint** — engineering artifacts ready; legal sign-off pending.
