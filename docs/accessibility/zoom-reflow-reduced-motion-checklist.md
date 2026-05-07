# Zoom, Reflow, and Reduced-Motion Regression Checklist

Last updated: 2026-05-07

Reference standard: WCAG 2.1 Success Criteria 1.4.4 (Resize text), 1.4.10 (Reflow), and 2.3.3 (Animation from Interactions — WCAG 2.1 AAA, targeted for engineering).

---

## How to use this checklist

Run these checks manually in a real browser against the staging or local dev server. Automated tooling (jest-axe, axe-core) cannot validate zoom/reflow or motion behaviour — these require human verification.

For each check, mark **Pass**, **Fail**, or **N/A**. Record findings in a dated row at the bottom of the Results Log.

---

## 1. Text resize to 200% (SC 1.4.4)

Set browser zoom to 200% (`Ctrl/Cmd +` or browser settings). Verify for each route:

- [ ] No text is clipped or truncated by overflow: hidden without scroll.
- [ ] No text overlaps other text.
- [ ] All form labels remain adjacent to their inputs.
- [ ] All button text remains fully readable (not cut off by fixed height containers).
- [ ] Navigation menus remain usable (hamburger collapses correctly on narrow+zoom).

**Routes to check:**

- [ ] `/` (landing / marketing homepage)
- [ ] `/accessibility` (accessibility statement)
- [ ] `/accessibility/report` (report form)
- [ ] `/sign-in`, `/sign-up`, `/forgot-password`
- [ ] `/dashboard` (appointments calendar)
- [ ] `/finance` (invoice table)
- [ ] `/companions` (companion list)

---

## 2. Reflow at 320 CSS pixels (SC 1.4.10)

Set viewport to 320 px wide (or browser zoom to 400% on a 1280 px screen). Verify for each route that content reflows to a single column without horizontal scrolling:

- [ ] No horizontal scrollbar appears on the page (except data tables that have an explicit overflow-x: auto container — acceptable if the table itself scrolls, not the page).
- [ ] Calendar week view: acceptable to scroll horizontally within its container; the page chrome must not scroll.
- [ ] Invoice table: acceptable horizontal scroll within `overflow-x: auto` wrapper.
- [ ] All form fields stack vertically.
- [ ] The breadcrumb on `/accessibility/report` wraps gracefully.
- [ ] The submit + cancel button row wraps to stacked layout.

**Routes to check:**

- [ ] `/accessibility/report`
- [ ] `/sign-in`, `/sign-up`
- [ ] `/dashboard` (calendar view)
- [ ] `/finance`
- [ ] `/companions`

---

## 3. Reduced-motion compliance (prefers-reduced-motion)

Open browser developer tools → Rendering → Enable "Emulate CSS media feature prefers-reduced-motion: reduce". Verify:

**Global baseline (globals.css)**

- [ ] `prefers-reduced-motion: reduce` block in `globals.css` is active — all `transition-*`, `animation-*`, and `@keyframes` rules are suppressed or reduced for motion-sensitive users.

**Calendar auto-scroll (`Calendar/helpers.ts`)**

- [ ] Appointments auto-scroll to current time slot uses `smooth` behaviour for standard users.
- [ ] With reduced-motion enabled, auto-scroll falls back to `instant` (no smooth animation).
- [ ] Manually verify: load the Appointments calendar page with reduced-motion enabled — the timeline should jump directly to the current hour with no scroll animation.

**Modals and overlays**

- [ ] `ModalBase` open/close transitions are suppressed under reduced-motion.
- [ ] `AppointmentPopover` and `TaskSlot` dialogs open without fly-in animation under reduced-motion.

**Route transitions**

- [ ] Page navigation does not trigger a full-page slide or fade animation under reduced-motion.

---

## 4. Focus visibility at 200% zoom

At 200% zoom, verify that focus rings remain visible and are not clipped:

- [ ] Skip link focus ring visible at top of page.
- [ ] All form input focus rings (ring-2 class) fully visible when inputs are near viewport edges.
- [ ] Modal close button focus ring visible.
- [ ] Popover dialog action button focus rings visible.

---

## 5. Touch target size (informative — WCAG 2.5.5 AAA)

At native resolution (not zoom), verify interactive elements have a minimum 44×44 CSS px touch target. Not a hard blocker but document failures:

- [ ] Submit button on `/accessibility/report`
- [ ] Cancel link on `/accessibility/report`
- [ ] Appointment popover action icon buttons (accept, decline, reschedule etc.)
- [ ] Task slot action icon buttons (view, change status, reschedule)
- [ ] Mobile navigation menu toggle

---

## Results Log

| Date        | Tester | Browser / OS | Notes                                |
| ----------- | ------ | ------------ | ------------------------------------ |
| _(pending)_ |        |              | First manual pass — all checks above |

---

## Known issues / accepted exceptions

- **Stripe payment iframe**: Zoom and reflow behaviour within the Stripe embedded iframe is outside our control. WCAG exception documented in the accessibility statement.
- **IDEXX workspace iframe**: Same third-party exception.
- **Calendar week view horizontal scroll**: Accepted — the scrolling element is the timeline container, not the page. Page-level horizontal scroll is absent.
