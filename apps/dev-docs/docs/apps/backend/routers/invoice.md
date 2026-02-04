---
id: backend-api-invoice
title: Invoice API
slug: /apps/backend/api/invoice
---

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
