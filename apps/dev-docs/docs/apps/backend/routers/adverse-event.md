---
id: backend-api-adverse-event
title: Adverse Event API
slug: /apps/backend/api/adverse-event
---

Manages adverse event reports (for example, a suspected reaction to a medication). The mobile app submits reports and looks up regulatory-authority information, while the PIMS (Practice Information Management System, the clinic-facing web app) lists reports for an organisation and updates their status.

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
