---
id: backend-api-finance
title: Finance API
slug: /apps/backend/api/finance
---

Covers billing: discount policy, subscriptions and usage metering, invoices and their line items, payments, refunds, and the checkout-session relays used by both the PIMS (Practice Information Management System, the clinic-facing web app) and the mobile app. Routes under `/mobile` are called by the mobile app on behalf of a pet parent and use `requireMobileAuth` with no organisation RBAC (role-based access control) check; the remaining routes are called by the PIMS and require organisation RBAC, scoped through whichever resource the route is addressed by (`withOrgPermissions` for organisation-level routes, or a resource-derived variant — `withInvoiceOrgPermissions`, `withPaymentOrgPermissions`, `withPaymentIntentOrgPermissions`, `withAppointmentOrgPermissions` — for routes addressed by an invoice, payment, payment intent, or appointment id). Every success response uses the envelope `{ data, meta: null, error: null }`; errors return `{ message }` at the originating service's status code, or `500` with a generic message. Three appointment-scoped payment endpoints (`POST /invoices/:invoiceId/payments/sessions`, `GET /:invoiceId`, `POST /mobile/appointments/:appointmentId/invoices`) are additionally rate-limited to 120 requests per 15 minutes per appointment (`financeAppointmentLimiter`).

**Endpoints**

### GET /organisation/:organisationId/discount-settings

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `FinanceController.getDiscountSettings`

### PUT /organisation/:organisationId/discount-settings

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission` (gated on `org:edit`, held only by OWNER/ADMIN, not the `billing:edit:any` permission the rest of this API uses — the cap is a policy limit on the staff who apply discounts, so it cannot be gated on the permission it limits)
- Params: `organisationId`
- Body: `{ maxOverallDiscountPercent: number | null }`
- Controller: `FinanceController.updateDiscountSettings`

### GET /organisation/:organisationId/subscription/seat-sync-plan

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `FinanceController.getSubscriptionSeatSyncPlan`

### POST /organisation/:organisationId/subscription/provider/:provider/customer

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Body: `{ externalCustomerId: string }`
- Controller: `FinanceController.recordSubscriptionCustomer`

### POST /organisation/:organisationId/subscription/provider/:provider/checkout/completed

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Body: `SubscriptionCheckoutCompletedBodySchema`
- Body fields: `customerId`, `subscriptionId`, `subscriptionItemId`, `priceId`, `productId`, `billingInterval` (`month`, `year`), `subscriptionStatus` (`none`, `trialing`, `active`, `past_due`, `unpaid`, `canceled`, `incomplete`, `incomplete_expired`, `paused`), `cancelAtPeriodEnd`, `currentPeriodStart`, `currentPeriodEnd`, `livemode`, `seatQuantity`
- Controller: `FinanceController.recordSubscriptionCheckoutCompleted`
- Response: `201`: keys `data`, `meta`, `error`

### POST /organisation/:organisationId/subscription/provider/:provider/updated

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Body: `SubscriptionUpdatedBodySchema`
- Body fields: `subscriptionId`, `subscriptionStatus`, `cancelAtPeriodEnd`, `canceledAt`, `seatQuantity`, `currentPeriodStart`, `currentPeriodEnd`
- Controller: `FinanceController.recordSubscriptionUpdated`

### POST /organisation/:organisationId/subscription/provider/:provider/deleted

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Body: `SubscriptionLifecycleBodySchema`
- Body fields: `subscriptionId`, `invoiceId`
- Controller: `FinanceController.recordSubscriptionDeleted`

### POST /organisation/:organisationId/subscription/provider/:provider/invoice-paid

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Body: `SubscriptionLifecycleBodySchema`
- Body fields: `subscriptionId`, `invoiceId`
- Controller: `FinanceController.recordSubscriptionInvoicePaid`

### POST /organisation/:organisationId/subscription/provider/:provider/invoice-failed

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Body: `SubscriptionLifecycleBodySchema`
- Body fields: `subscriptionId`, `invoiceId`
- Controller: `FinanceController.recordSubscriptionInvoiceFailed`

### GET /subscriptions/current

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Query: `organisationId`
- Controller: `FinanceController.getCurrentSubscription`

### POST /subscriptions

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body: `UpsertSubscriptionBodySchema`
- Body fields: `organisationId`, `planCode`, `provider`, `providerSubscriptionId`, `quantity`
- Controller: `FinanceController.upsertSubscription`
- Response: `201`: keys `data`, `meta`, `error`

### POST /usage-events

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body: `UsageEventBodySchema`
- Body fields: `usageKey`, `quantity`, `billableQuantity`, `source`, `referenceType`, `referenceId`, `metadata`, `occurredAt`
- Controller: `FinanceController.recordUsageEvent`
- Response: `201`: keys `data`, `meta`, `error`

### GET /usage-snapshots

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Query: `organisationId`, `subscriptionId`, `featureKey`
- Controller: `FinanceController.getUsageSnapshots`

### POST /visits/:visitId/milestones

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `visitId`
- Body: `VisitMilestoneBodySchema`
- Body fields: `milestone` (`BOOKED`, `CHECKED_IN`, `IN_PROGRESS`, `ADDITIONAL_CHARGE_ADDED`, `READY_FOR_BILLING`, `VISIT_ENDED`, `DISCHARGED`, `HOSPITALIZATION_STARTED`, `HOSPITALIZATION_EXTENDED`, `HOSPITALIZATION_DISCHARGED`), `organisationId`, `appointmentId`, `patientId`, `metadata`
- Controller: `FinanceController.recordVisitMilestone`
- Response: `201`: keys `data`, `meta`, `error`; `404`: keys `message` (milestone is `READY_FOR_BILLING` but no invoice exists for the appointment)

### POST /appointments/:appointmentId/ready-for-billing

- Auth: `requireWebAuth`
- RBAC: `withAppointmentOrgPermissions, requirePermission`
- Params: `appointmentId`
- Body: `ReadyForBillingBodySchema`
- Body fields: `visitId`, `notes`
- Controller: `FinanceController.markAppointmentReadyForBilling`
- Response: `404`: keys `message` (no invoice found for the appointment)

### DELETE /appointments/:appointmentId/ready-for-billing

- Auth: `requireWebAuth`
- RBAC: `withAppointmentOrgPermissions, requirePermission`
- Params: `appointmentId`
- Controller: `FinanceController.reverseAppointmentReadyForBilling`
- Response: `404`: keys `message` (no invoice found for the appointment)

### GET /invoices

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Query: `organisationId`, `appointmentId`, `parentId`, `patientId` (at least one required)
- Controller: `FinanceController.listInvoices`

### POST /invoices

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body: `CreateInvoiceBodySchema`
- Body fields: `appointmentId`, `parentId`, `patientId`, `organisationId`, `paymentCollectionMethod`, `items` (array of `{ name, quantity, unitPrice, total, description, discountPercent }`), `invoiceDiscount` (`{ type: "FIXED_AMOUNT" | "PERCENTAGE", value }`), `notes`
- Controller: `FinanceController.createInvoice`
- Response: `201`: keys `data`, `meta`, `error`

### POST /invoices/:invoiceId/lines

- Auth: `requireWebAuth`
- RBAC: `withInvoiceOrgPermissions, requirePermission`
- Params: `invoiceId`
- Body: `SupplementInvoiceBodySchema`
- Body fields: `items` (array of `{ name, quantity, unitPrice, total, description, discountPercent }`)
- Controller: `FinanceController.addInvoiceItems`

### GET /invoices/:invoiceId

- Auth: `requireWebAuth`
- RBAC: `withInvoiceOrgPermissions, requirePermission`
- Params: `invoiceId`
- Controller: `FinanceController.getInvoiceById`

### GET /invoices/payment-intent/:paymentIntentId

- Auth: `requireWebAuth`
- RBAC: `withPaymentIntentOrgPermissions, requirePermission`
- Params: `paymentIntentId`
- Controller: `FinanceController.retrievePaymentIntent`

### POST /invoices/:invoiceId/finalize

- Auth: `requireWebAuth`
- RBAC: `withInvoiceOrgPermissions, requirePermission`
- Params: `invoiceId`
- Body: `{ taxProvider?: string }`
- Controller: `FinanceController.finalizeInvoice`

### POST /invoices/:invoiceId/closeout

- Auth: `requireWebAuth`
- RBAC: `withInvoiceOrgPermissions, requirePermission`
- Params: `invoiceId`
- Body: `CloseoutInvoiceBodySchema`
- Body fields: `settlementChannel` (`CASH`, `BANK_TRANSFER`, `CARD_PRESENT`, `DEPOSIT`, `OTHER`), `reference`, `receivedAt`
- Controller: `FinanceController.settleInvoiceAtCloseout`

### POST /invoices/:invoiceId/tax/preview

- Auth: `requireWebAuth`
- RBAC: `withInvoiceOrgPermissions, requirePermission`
- Params: `invoiceId`
- Body: `{ taxProvider?: string }`
- Controller: `FinanceController.previewInvoiceTax`

### POST /invoices/:invoiceId/tax/finalize

- Auth: `requireWebAuth`
- RBAC: `withInvoiceOrgPermissions, requirePermission`
- Params: `invoiceId`
- Body: `{ taxProvider?: string }`
- Controller: `FinanceController.finalizeInvoice` (same handler as `POST /invoices/:invoiceId/finalize`)

### POST /invoices/:invoiceId/void

- Auth: `requireWebAuth`
- RBAC: `withInvoiceOrgPermissions, requirePermission`
- Params: `invoiceId`
- Body: `{ reason?: string }`
- Controller: `FinanceController.voidInvoice`

### POST /invoices/:invoiceId/supplement

- Auth: `requireWebAuth`
- RBAC: `withInvoiceOrgPermissions, requirePermission`
- Params: `invoiceId`
- Body: `SupplementInvoiceBodySchema`
- Body fields: `items` (array of `{ name, quantity, unitPrice, total, description, discountPercent }`)
- Controller: `FinanceController.supplementInvoice`
- Response: `201`: keys `data`, `meta`, `error`

### POST /invoices/:invoiceId/payments

- Auth: `requireWebAuth`
- RBAC: `withInvoiceOrgPermissions, requirePermission`
- Params: `invoiceId`
- Body: `RecordInvoicePaymentBodySchema`
- Body fields: `provider` (must resolve to `MANUAL`), `settlementChannel` (`CASH`, `BANK_TRANSFER`, `CARD_PRESENT`, `DEPOSIT`, `OTHER`; defaults to `CASH`), `amount`, `currency`, `reference`, `receivedAt`
- Controller: `FinanceController.recordInvoicePayment`
- Response: `201`: keys `data`, `meta`, `error`; `409`: keys `message` (invoice already settled)

### POST /invoices/:invoiceId/payments/sessions

- Auth: `requireWebAuth`
- RBAC: `withInvoiceOrgPermissions, requirePermission`
- Params: `invoiceId`
- Body: `CreateInvoicePaymentSessionBodySchema`
- Body fields: `provider` (must resolve to `STRIPE`), `depositAmount` (major units; present when collecting a deposit rather than the full balance)
- Controller: `FinanceController.createInvoicePaymentSession`
- Response: `201`: keys `data`, `meta`, `error`

### GET /:invoiceId

- Auth: `requireWebAuth`
- RBAC: `withInvoiceOrgPermissions, requirePermission`
- Params: `invoiceId`
- Controller: `FinanceController.getInvoiceById`

### GET /mobile/parents/:parentId/invoices

- Auth: `requireMobileAuth`
- Params: `parentId`
- Controller: `FinanceController.listInvoicesForParent`

### POST /mobile/appointments/:appointmentId/invoices

- Auth: `requireMobileAuth`
- Params: `appointmentId`
- Controller: `FinanceController.listInvoicesForAppointment`

### POST /mobile/appointments/:appointmentId/seed

- Auth: `requireMobileAuth`
- Params: `appointmentId`
- Controller: `FinanceController.bootstrapInvoiceForAppointment`

### POST /mobile/invoices/:invoiceId/payments/sessions

- Auth: `requireMobileAuth`
- Params: `invoiceId`
- Controller: `FinanceController.createMobileInvoicePaymentSession`
- Response: `201`: keys `data`, `meta`, `error`

### GET /mobile/payment-intent/:paymentIntentId

- Auth: `requireMobileAuth`
- Params: `paymentIntentId`
- Controller: `FinanceController.retrievePaymentIntent`

### GET /mobile/:invoiceId

- Auth: `requireMobileAuth`
- Params: `invoiceId`
- Controller: `FinanceController.getInvoiceById`

### POST /payments/:paymentId/refunds

- Auth: `requireWebAuth`
- RBAC: `withPaymentOrgPermissions, requirePermission`
- Params: `paymentId`
- Body: `RefundPaymentBodySchema`
- Body fields: `amount`, `reason`
- Controller: `FinanceController.refundPayment`
- Response: `201`: keys `data`, `meta`, `error`
