---
id: backend-api-invoice
title: Invoice API
slug: /apps/backend/api/invoice
---

Covers invoices tied to appointments: listing them, adding charges, looking them up by payment intent, and creating Stripe checkout sessions. Routes under `/mobile` are called by the mobile app on behalf of a pet parent; the remaining routes are called by the PIMS (Practice Information Management System, the clinic-facing web app). See the [Stripe API](./stripe.md) for the underlying payment endpoints.

**Endpoints**

### GET /mobile/appointment/:appointmentId

- Auth: `authorizeCognitoMobile`
- Params: `appointmentId`
- Controller: `InvoiceController.listInvoicesForAppointment`

### GET /mobile/payment-intent/:paymentIntentId

- Auth: `authorizeCognitoMobile`
- Params: `paymentIntentId`
- Controller: `InvoiceController.getInvoiceByPaymentIntentId`

### GET /mobile/:invoiceId

- Auth: `authorizeCognitoMobile`
- Params: `invoiceId`
- Controller: `InvoiceController.getInvoiceById`

### POST /appointment/:appointmentId/charges

- Auth: `authorizeCognito`
- Params: `appointmentId`
- Controller: `InvoiceController.addChargesToAppointment`

### GET /appointment/:appointmentId

- Auth: `authorizeCognito`
- Params: `appointmentId`
- Controller: `InvoiceController.listInvoicesForAppointment`

### GET /payment-intent/:paymentIntentId

- Auth: `authorizeCognito`
- Params: `paymentIntentId`
- Controller: `InvoiceController.getInvoiceByPaymentIntentId`

### GET /organisation/:organisationId/list

- Auth: `authorizeCognito`
- Params: `organisationId`
- Controller: `InvoiceController.listInvoicesForOrganisation`

### POST /:invoiceId/checkout-session

- Auth: `authorizeCognito`
- Params: `invoiceId`
- Controller: `InvoiceController.createCheckoutSessionForInvoice`

### GET /:invoiceId

- Auth: `authorizeCognito`
- Params: `invoiceId`
- Controller: `InvoiceController.getInvoiceById`
