# PIMS 1:1 design pass — deferred findings

Companion to the fidelity audit behind PR #1916. The audit found 344 element-level gaps between the web
PIMS and the 19 July design bundle; 316 were implemented. This file records the ones that were **not**
applied, and why, so the decisions are not lost.

Two originally-deferred items were subsequently implemented on request and are **not** listed here:
the medical-record lifecycle tabs, and the workspace payment-link / check-in / series signals.

---

## A. Applying the design would delete working functionality

These need a product decision, not a styling change.

| Area                  | Design wants                                                         | What it would remove                                                                                                                                                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Appointment list      | Columns: Time, Patient, Service, Practitioner, Room, Status          | Deletes four columns the app surfaces today: Reason, Date/Time, Lead, Support                                                                                                                                                                                                               |
| Invoices              | Status column at 110px                                               | The longest live label, `AWAITING PAYMENT`, measures ~134px at 10px/700/0.08em, so the pill bleeds into the Payment cell. Only reconcilable if the status taxonomy is shortened                                                                                                             |
| Dispensary restock    | One row per medication, with batch subline and inline LOW STOCK chip | `DispensaryRecord` is one row per prescription _request_ (with an `items[]` array); rebuilding also drops Amount, Requested, Location and Dispensed                                                                                                                                         |
| New-appointment modal | Inline 6-up slot grid                                                | Deletes four exported, individually unit-tested components (`TimeSlotDropdown`, `TimeSlotMenuContent`, `TimeSlotTriggerValue`, `TimeSlotLoadingMessage`) and rewrites ~40 assertions. The "unavailable slot" strike-through is also unbuildable: the slots API only returns available slots |
| IDEXX settings        | Read-only credential rows in a right drawer                          | Removes credential entry entirely, and needs `ui/overlays/Modal` swapped for `ModalBase`                                                                                                                                                                                                    |
| Inventory             | 470px restock drawer                                                 | A new feature, not a drift: new form state, validation, submit path and derived totals. The existing `InventoryInfo` stock/batch path already carries every field it specifies                                                                                                              |
| Tasks                 | "Linked companion" field beside Category                             | Writes `companionId` into the create payload for `EMPLOYEE_TASK` records — a data-flow change. The Assign-to parent chips already carry the companion link                                                                                                                                  |
| Add companion         | Inline Parent quick-picker in step 1                                 | Creates two sources of truth; the app deliberately keeps parent selection in step 2                                                                                                                                                                                                         |
| Availability          | Drop the "Requested" filter pill                                     | `Requested` is a real `TeamStatus`; the pill is the only way to filter that cohort                                                                                                                                                                                                          |

## B. Blocked on a backend / shared-type change

| Area                                | Blocker                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IDEXX "Acknowledge" row action      | No acknowledgement state exists on `LabResult`, in the schema, the API or permissions. Tracked by #1867. A test explicitly asserts the app never claims results are acknowledged, only that they await review                                                                                                                                                   |
| Dashboard "↑ 12%" delta             | `useDashboardAnalytics` exposes explore/totals/charts only — there is no prior-period series to compare against. The real period total is rendered instead                                                                                                                                                                                                      |
| Organization "Clinic" business type | Adding `CLINIC` to `BusinessType` breaks three exhaustive `Record<BusinessType, …>` maps (onboarding `OrgStep`, inventory `CategoryOptionsByBusiness` and `IntendedUsageOptions`), and `Organisation['type']` in `@yosemite-crew/types` has no `CLINIC` member, so it could never persist. Needs a coordinated `packages/types` + onboarding + inventory change |

## C. Findings sourced from the wrong design frame

All six `companionHistory` findings (#5, #10, #11, #14, #15, #16) came from the **Records & Reference**
medical-record frame, but that page implements the **PIMS - Companions** frame (lines 235-300) 1:1.
Three of them directly contradict other, correct findings in the same area — e.g. #10/#11 ask for
bordered card rows with a 38px blue-soft icon tile, while the Companions frame specifies the 34px
status-tinted disc with a 1.5px spine that the app already renders. Applying them would have broken
the frame the page actually follows.

This is the known mis-mapping in the audit: the MSD/records frames were assigned to the wrong area and
remain un-audited against their real screens.

## D. Belongs to a shared owner outside the area

| Item                                                                        | Correct owner                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in page composition (video backdrop, 460px card, top bar, status pill) | `features/marketing/site/AuthShell.tsx` — shared by SignUp / ForgotPassword / ResetPassword, so changing SignIn alone would fork the auth flow. Assets already exist (`HERO_VIDEOS`, `HERO_POSTERS`, `HeroVideo`); design at `PIMS - Onboarding & Auth.dc.html:63-89` |
| Input pattern: 44px, label above, 12px radius                               | The shared `FormInput` / `LabelDropdown` / `Datepicker` primitives. Systemic, not companions-specific                                                                                                                                                                 |
| Notifications "View all"                                                    | Needs a `/notifications` route before `onViewAll` can be wired. The footer already right-aligns its lone control                                                                                                                                                      |
| Template active-row highlight                                               | The enabling half landed: `GenericTable` now takes an optional `rowClassName(item, index)`. The Forms page only needs to pass the active id                                                                                                                           |
| State-card CTA (40px tall, 12.5px text, 0 17px padding)                     | Would need a fifth button size used by exactly one screen. Current gap is 1px of padding and 1px of font size                                                                                                                                                         |
| Marketing `.yc-field` radius 13px -> 12px                                   | `features/marketing/site/marketing.css:465` — auth inputs otherwise keep a 13px radius while every component input is now 12px                                                                                                                                        |

## E. Design is internally inconsistent

The field height/padding pairing differs between frames: `PIMS - Tasks & Chat` uses 44px height with
`0 14px` padding (15 occurrences across the bundle), while `PIMS - Onboarding & Auth` uses 46px with
`0 15px` (7 occurrences). The dominant 44px/14px pairing was adopted. If the onboarding frame is
preferred instead, the correct combined change is `h-[46px]` + `px-[15px]` — not 44px + 15px, which
matches no frame.
