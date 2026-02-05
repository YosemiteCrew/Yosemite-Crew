---
id: backend-api-adverse-event
title: Adverse Event API
slug: /apps/backend/api/adverse-event
---

**Endpoints**

### POST /
- Auth: `authorizeCognitoMobile`
- Body: `AdverseEventReport`
- Controller: `AdverseEventController.createFromMobile`
- Response: `201`: keys `message`, `500`: keys `message`

### GET /regulatory-authority/
- Auth: `authorizeCognitoMobile`
- Controller: `AdverseEventController.getRegulatoryAuthorityInof`

### GET /organisation/:organisationId
- Params: `organisationId`
- Controller: `AdverseEventController.getById`

### PATCH /:id/status
- Params: `id`
- Body: `{ status: AdverseEventStatus }`
- Controller: `AdverseEventController.updateStatus`
