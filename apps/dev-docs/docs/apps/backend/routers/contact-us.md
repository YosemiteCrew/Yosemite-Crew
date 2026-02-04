---
id: backend-api-contact-us
title: Contact Us API
slug: /apps/backend/api/contact-us
---

**Endpoints**

### POST /contact
- Auth: `authorizeCognitoMobile`
- Controller: `ContactController.create`

### GET /requests
- Auth: `authorizeCognito`
- Controller: `ContactController.getById`

### PATCH /requests/:id/status
- Auth: `authorizeCognito`
- Params: `id`
- Controller: `ContactController.updateStatus`
