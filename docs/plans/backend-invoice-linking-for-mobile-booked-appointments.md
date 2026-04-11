# Backend Handoff: Production-Grade Payment Contract For Mobile-Booked Appointments In PMS

## Goal

Keep product behavior as-is:

- **Mobile app**: customer-facing flow remains **Stripe-only**.
- **PMS web**: staff-facing flow must always support **Pay in cash** and **Generate & Mail link** for the same appointment, regardless of whether appointment was booked from mobile or web.

## Current Flow Analysis (from code)

### Web booking (works today)

- Frontend creates appointment via `POST /fhir/v1/appointment/pms?createPayment=true`.
- Backend `createAppointmentFromPms(...)` creates:
  - appointment
  - draft invoice (`InvoiceService.createDraftForAppointment`)
  - optional checkout session when `createPayment=true`
- PMS invoice actions work because invoice is present and linked.

### Mobile booking (gap)

- Mobile books via `POST /fhir/v1/appointment/mobile/?createPayment=true`.
- Backend `createRequestedFromMobile(...)` currently returns:
  - appointment
  - payment intent (`StripeService.createPaymentIntentForAppointment`)
- It does **not** guarantee a persisted invoice discoverable by PMS invoice endpoints.

Observed symptom:

- Appointment can show `appointment-payment-status = UNPAID`, but:
  - `POST /fhir/v1/invoice/appointment/:appointmentId` returns `[]`
  - PMS has no invoiceId, so cash/link actions are disabled.

## Hard Constraint

Do not use mobile Stripe endpoint from PMS client:

- `POST /v1/stripe/payment-intent/:appointmentId` is `authorizeCognitoMobile`.
- PMS token call returns `401` and can trigger logout/retry cascades in web.

## Production-Grade Backend Contract (Required)

### Canonical invariant

For any appointment in status requiring payment (`REQUESTED`, `UPCOMING`, `NO_PAYMENT`, `AWAITING_PAYMENT`, `UNPAID` payment state):

1. There is at least one canonical invoice row/document linked by `appointmentId`.
2. That invoice is discoverable by:
   - appointment-scoped lookup
   - organisation list lookup
3. Payment transitions (cash/link/paid/refund) are performed on invoice, not inferred ad-hoc from appointment.

### Contract unification across channels

Both web-created and mobile-created appointments must satisfy the same output contract:

- Appointment response includes resolvable invoice linkage (`invoiceId` preferred; otherwise guarantee invoice query by appointment never empty for payable states).
- Invoice records include:
  - `id`
  - `appointmentId`
  - `organisationId`
  - `status`
  - `paymentCollectionMethod`
  - Stripe metadata fields (when applicable)

## Backend Change Plan

### 1) Mobile appointment create path must persist invoice (not just PI)

In `createRequestedFromMobile(...)`:

- Create or ensure draft invoice linked to appointment (same pattern used by PMS create flow).
- If Stripe PI is needed for mobile pay-now, attach PI metadata to that invoice.
- Return `{ appointment, invoice, paymentIntent }` (or at minimum guarantee invoice discoverability immediately).

### 1.1) Payment intent strategy must be aligned to invoice lifecycle (critical)

Current Stripe behavior for mobile appointment PI (`metadata.type = APPOINTMENT_BOOKING`) uses `_handleAppointmentBookingPayment(...)` and creates a PAID invoice on success.

If backend starts creating draft invoice at appointment creation, this legacy handler can create duplicate invoices unless changed.

Required safe options:

1. Preferred: make mobile payment intent invoice-based (`INVOICE_PAYMENT`) against canonical invoice ID, then settle same invoice.
2. Acceptable: keep appointment-based PI, but change `_handleAppointmentBookingPayment(...)` to:
   - find open invoice by appointment
   - mark that invoice paid and attach stripe fields
   - never create a second invoice when open invoice exists

Non-negotiable:

- no duplicate payable invoices for same appointment due to webhook race/retry.

### 2) Add/upgrade invoice bootstrap endpoint for PMS-safe recovery (recommended)

Provide PMS-authorized endpoint:

- `POST /fhir/v1/invoice/pms/appointment/:appointmentId/bootstrap`
- auth: `authorizeCognito` + RBAC `billing:edit:any`

Behavior (idempotent):

1. If open payable invoice exists for appointment, return it.
2. Else create invoice from appointment/service pricing, return it.
3. Never create duplicate payable invoices for same appointment unless explicitly requested by business rule.

Reason: deterministic recovery path for legacy data and future race conditions.

### 3) Keep existing lookup endpoints strict and complete

- `POST /fhir/v1/invoice/appointment/:appointmentId` must return invoice(s) for any linked appointment.
- `GET /fhir/v1/invoice/organisation/:organisationId/list` must include those same invoices.
- Ensure consistent behavior in both persistence modes (Postgres and Mongo paths).

## Slot/Occupancy Non-Regression Requirements

Invoice/payment fixes must not alter booking availability behavior.

1. Mobile requested appointment must keep current occupancy semantics (no unintended occupancy create/delete).
2. PMS approve/reschedule/cancel must remain authoritative for occupancy mutations.
3. Invoice bootstrap/create paths must not touch occupancy tables/collections.
4. Vet overlap validation logic must remain unchanged in:
   - `approveRequestedFromPms`
   - `createAppointmentFromPms`
   - `updateAppointmentPMS`
5. Cancel/reject flows must keep current occupancy cleanup behavior.

## Data Integrity and Idempotency Requirements

1. Enforce uniqueness for canonical payable invoice per appointment (or explicit versioning strategy).
2. All create/bootstrap operations must be idempotent under retries.
3. On dual-write systems, commit ordering must prevent “appointment exists, invoice missing” windows beyond acceptable SLA.
4. If asynchronous jobs are used, return a recoverable state and eventual consistency bound (for example, < 2s), plus a polling/readiness field.
5. Stripe webhook handling must be idempotent for repeated events and retries without producing duplicate invoices or conflicting status transitions.

## API Response Requirements (Industry Standard)

For appointment create responses where payment is applicable:

- include `invoiceId` directly on appointment payload (preferred), and/or
- include embedded `invoice` object.

For invoice responses:

- use stable schema and typed enums for `status` and `paymentCollectionMethod`.
- include server-generated timestamps and correlation identifiers.

## Security and Auth Model

1. Keep mobile-only Stripe PI route mobile-auth only.
2. Expose PMS-safe equivalents under PMS auth + RBAC where needed.
3. Never require PMS web to call mobile-auth endpoints.

## Observability and Operations

Add logs/metrics with appointmentId and invoiceId correlation:

1. `appointment_created_mobile_total`
2. `invoice_missing_for_payable_appointment_total`
3. `invoice_bootstrap_invoked_total`
4. `invoice_bootstrap_created_total`
5. `invoice_lookup_empty_total` (by endpoint and org)
6. `duplicate_invoice_for_appointment_total`
7. `webhook_invoice_settlement_conflict_total`

Alert on non-zero sustained rate of “payable appointment with no invoice”.

## Migration / Backfill (Required)

Run one-time backfill for existing affected records:

1. Find appointments in payable states with no linked invoice.
2. Create/attach canonical invoice using service pricing at booking snapshot.
3. Preserve audit trail with migration metadata.

## Acceptance Criteria

Using known failing case `69c221b94e7ae303c1e1926e` and fresh bookings:

1. Mobile-booked appointment immediately has discoverable invoice.
2. `POST /fhir/v1/invoice/appointment/:appointmentId` returns non-empty for payable mobile-booked appointments.
3. `GET /fhir/v1/invoice/organisation/:organisationId/list` includes same invoice.
4. PMS actions succeed end-to-end:
   - `PATCH /fhir/v1/invoice/:invoiceId/payment-collection-method` (`PAYMENT_AT_CLINIC`)
   - `POST /fhir/v1/invoice/:invoiceId/checkout-session` (Generate & Mail link)
   - `POST /fhir/v1/invoice/:invoiceId/mark-paid` (cash collected)
5. Mobile remains Stripe-only UX; no cash path exposed in app UI.
6. No 401/logout side effects in PMS during payment actions.

## Test Plan (Backend)

1. Unit: mobile create flow persists invoice + PI linkage.
2. Unit: bootstrap endpoint idempotency and duplicate prevention.
3. Integration: mobile booking -> PMS invoice lookup -> cash/link actions.
4. Integration: org list includes mobile-booked invoices.
5. Integration: dual-path parity (Postgres mode and Mongo mode).
6. Regression: webhook and refund flows preserve invoice linkage and status integrity.
7. Regression: slot blocking/occupancy matrix remains unchanged:
   - mobile create requested (no accidental occupancy mutation)
   - PMS approve creates occupancy
   - PMS reschedule updates occupancy atomically
   - cancel/reject remove occupancy as before
8. Regression: no duplicate invoices when paying mobile-booked appointment (single canonical invoice transitions `AWAITING_PAYMENT -> PAID`).
