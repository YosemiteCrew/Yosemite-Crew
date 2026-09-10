---
id: backend-api-finance
title: Finance API
slug: /apps/backend/api/finance
---

Mobile routes are called by the mobile app on behalf of a pet parent.

**Endpoints**

### GET /organisation/:organisationId/discount-settings

- Auth: `requireWebAuth`
- Permission: `billing:view:any`
- Controller: `FinanceController`

### PUT /organisation/:organisationId/discount-settings

- Auth: `requireWebAuth`
- Permission: `org:edit`
- Controller: `FinanceController`

### GET /organisation/:organisationId/subscription/seat-sync-plan

- Auth: `requireWebAuth`
- Permission: `subscription:view:any`
- Controller: `FinanceController`

### POST /organisation/:organisationId/subscription/provider/:provider/customer

- Auth: `requireWebAuth`
- Permission: `subscription:edit:any`
- Controller: `FinanceController`

### POST /organisation/:organisationId/subscription/provider/:provider/checkout/completed

- Auth: `requireWebAuth`
- Permission: `subscription:edit:any`
- Controller: `FinanceController`

### POST /organisation/:organisationId/subscription/provider/:provider/updated

- Auth: `requireWebAuth`
- Permission: `subscription:edit:any`
- Controller: `FinanceController`

### POST /organisation/:organisationId/subscription/provider/:provider/deleted

- Auth: `requireWebAuth`
- Permission: `subscription:edit:any`
- Controller: `FinanceController`

### POST /organisation/:organisationId/subscription/provider/:provider/invoice-paid

- Auth: `requireWebAuth`
- Permission: `subscription:edit:any`
- Controller: `FinanceController`

### POST /organisation/:organisationId/subscription/provider/:provider/invoice-failed

- Auth: `requireWebAuth`
- Permission: `subscription:edit:any`
- Controller: `FinanceController`

### GET /subscriptions/current

- Auth: `requireWebAuth`
- Permission: `subscription:view:any`
- Controller: `FinanceController`

### POST /subscriptions

- Auth: `requireWebAuth`
- Permission: `subscription:edit:any`
- Controller: `FinanceController`

### POST /usage-events

- Auth: `requireWebAuth`
- Permission: `subscription:edit:any`
- Controller: `FinanceController`

### GET /usage-snapshots

- Auth: `requireWebAuth`
- Permission: `subscription:view:any`
- Controller: `FinanceController`

### POST /visits/:visitId/milestones

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `FinanceController`

### POST /appointments/:appointmentId/ready-for-billing

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `FinanceController`

### DELETE /appointments/:appointmentId/ready-for-billing

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `FinanceController`

### GET /invoices

- Auth: `requireWebAuth`
- Permission: `billing:view:any`
- Controller: `FinanceController`

### POST /invoices

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `FinanceController`

### POST /invoices/:invoiceId/lines

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `FinanceController`

### GET /invoices/:invoiceId

- Auth: `requireWebAuth`
- Permission: `billing:view:any`
- Controller: `FinanceController`

### GET /invoices/payment-intent/:paymentIntentId

- Auth: `requireWebAuth`
- Permission: `billing:view:any`
- Controller: `FinanceController`

### POST /invoices/:invoiceId/finalize

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `FinanceController`

### POST /invoices/:invoiceId/closeout

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `FinanceController`

### POST /invoices/:invoiceId/tax/preview

- Auth: `requireWebAuth`
- Permission: `billing:view:any`
- Controller: `FinanceController`

### POST /invoices/:invoiceId/tax/finalize

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `FinanceController`

### POST /invoices/:invoiceId/void

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `FinanceController`

### POST /invoices/:invoiceId/supplement

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `FinanceController`

### POST /invoices/:invoiceId/payments

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `FinanceController`

### POST /invoices/:invoiceId/payments/sessions

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Rate limit: rate-limited
- Controller: `FinanceController`

### GET /:invoiceId

- Auth: `requireWebAuth`
- Permission: `billing:view:any`
- Rate limit: rate-limited
- Controller: `FinanceController`

### GET /mobile/parents/:parentId/invoices

- Auth: `requireMobileAuth`
- Controller: `FinanceController`

### POST /mobile/appointments/:appointmentId/invoices

- Auth: `requireMobileAuth`
- Rate limit: rate-limited
- Controller: `FinanceController`

### POST /mobile/appointments/:appointmentId/seed

- Auth: `requireMobileAuth`
- Controller: `FinanceController`

### POST /mobile/invoices/:invoiceId/payments/sessions

- Auth: `requireMobileAuth`
- Controller: `FinanceController`

### GET /mobile/payment-intent/:paymentIntentId

- Auth: `requireMobileAuth`
- Controller: `FinanceController`

### GET /mobile/:invoiceId

- Auth: `requireMobileAuth`
- Controller: `FinanceController`

### POST /payments/:paymentId/refunds

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `FinanceController`
