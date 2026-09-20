---
id: backend-api-contact-us
title: Contact Us API
slug: /apps/backend/api/contact-us
---

Handles "contact us" support requests. The mobile app submits a request (`POST /contact`); staff using the PIMS (Practice Information Management System, the clinic-facing web app) list requests and update their status.

**Endpoints**

### POST /contact

- Auth: `requireMobileAuth`
- Controller: `ContactController.create`

### GET /requests

- Auth: `requireWebAuth`
- Controller: `ContactController.getById`

### PATCH /requests/:id/status

- Auth: `requireWebAuth`
- Params: `id`
- Controller: `ContactController.updateStatus`
