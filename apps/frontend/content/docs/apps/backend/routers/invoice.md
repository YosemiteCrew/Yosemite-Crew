---
id: backend-api-invoice
title: Invoice API
slug: /apps/backend/api/invoice
---

Covers invoices tied to appointments: listing them, adding charges, looking them up by payment intent, and creating Stripe checkout sessions. Routes under `/mobile` are called by the mobile app on behalf of a pet parent; the remaining routes are called by the PIMS (Practice Information Management System, the clinic-facing web app). See the [Stripe API](./stripe.md) for the underlying payment endpoints.

**Endpoints**

### GET /mobile/appointment/:appointmentId

- Auth: `requireMobileAuth`
- Params: `appointmentId`
- Controller: `InvoiceController.listInvoicesForAppointment`

### GET /mobile/payment-intent/:paymentIntentId

- Auth: `requireMobileAuth`
- Params: `paymentIntentId`
- Controller: `InvoiceController.getInvoiceByPaymentIntentId`

### GET /mobile/:invoiceId

- Auth: `requireMobileAuth`
- Params: `invoiceId`
- Controller: `InvoiceController.getInvoiceById`

### POST /appointment/:appointmentId/charges

- Auth: `requireWebAuth`
- Params: `appointmentId`
- Controller: `InvoiceController.addChargesToAppointment`

### GET /appointment/:appointmentId

- Auth: `requireWebAuth`
- Params: `appointmentId`
- Controller: `InvoiceController.listInvoicesForAppointment`

### GET /payment-intent/:paymentIntentId

- Auth: `requireWebAuth`
- Params: `paymentIntentId`
- Controller: `InvoiceController.getInvoiceByPaymentIntentId`

### GET /organisation/:organisationId/list

- Auth: `requireWebAuth`
- Params: `organisationId`
- Controller: `InvoiceController.listInvoicesForOrganisation`

### POST /:invoiceId/checkout-session

- Auth: `requireWebAuth`
- Params: `invoiceId`
- Controller: `InvoiceController.createCheckoutSessionForInvoice`

### GET /:invoiceId

- Auth: `requireWebAuth`
- Params: `invoiceId`
- Controller: `InvoiceController.getInvoiceById`
