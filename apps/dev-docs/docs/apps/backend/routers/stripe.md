---
id: backend-api-stripe
title: Stripe API
slug: /apps/backend/api/stripe
---

Wraps the Stripe payment integration: the incoming Stripe webhook, payment intents and checkout sessions, and Stripe Connect account onboarding plus subscription billing for organisations. The webhook is called by Stripe; the payment-intent routes are called by the mobile app; the `/pms` and `/organisation` routes are called by the PMS (Practice Information Management System, the clinic-facing web app) and require organisation RBAC (role-based access control) permissions. See the [Invoice API](./invoice.md) for the invoices these payments settle.

**Endpoints**

### POST /webhook

- Body: `Buffer`
- Controller: `StripeController.webhook`
- Response: `200`: keys `Error`, `400`: keys `Error`

### POST /payment-intent/:appointmentId

- Auth: `authorizeCognitoMobile`
- Params: `appointmentId`
- Controller: `StripeController.createPaymentIntent`
- Response: `200`: keys `createPaymentIntent`, `400`: keys `error`, `message`

### GET /payment-intent/:paymentIntentId

- Auth: `authorizeCognitoMobile`
- Params: `paymentIntentId`
- Controller: `StripeController.retrievePaymentIntent`
- Response: `200`: keys `retrievePaymentIntent`, `400`: keys `error`, `message`

### GET /checkout-session/:sessionId

- Auth: `authorizeCognitoMobile`
- Params: `sessionId`
- Controller: `StripeController.createPaymentIntentForInvoice`
- Response: `200`: keys `createPaymentIntentForInvoice`, `400`: keys `error`, `message`

### POST /pms/payment-intent/:invoiceId

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `invoiceId`
- Controller: `StripeController.createPaymentIntentForInvoice`
- Response: `200`: keys `createPaymentIntentForInvoice`, `400`: keys `error`, `message`

### POST /organisation/:organisationId/account

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `StripeController.createOrGetConnectedAccount`
- Response: `200`: keys `createOrGetConnectedAccount`, `400`: keys `error`, `message`

### GET /organisation/:organisationId/account/status

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `StripeController.getAccountStatus`
- Response: `200`: keys `getAccountStatus`, `400`: keys `error`, `message`

### POST /organisation/:organisationId/onboarding

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `StripeController.createOnboardingLink`
- Response: `200`: keys `createOnboardingLink`, `400`: keys `error`, `message`

### POST /organisation/:organisationId/billing/checkout

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `StripeController.createBusinessCheckout`
- Response: `400`: keys `error`, `message`, `200`: keys `createBusinessCheckout`

### POST /organisation/:organisationId/billing/portal

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `StripeController.createBillingPortal`
- Response: `200`: keys `createBillingPortal`, `400`: keys `error`, `message`

### POST /organisation/:organisationId/billing/sync-seats

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `StripeController.syncSeats`
- Response: `200`: keys `syncSeats`, `400`: keys `error`, `message`
