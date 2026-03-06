---
id: backend-api-service
title: Service API
slug: /apps/backend/api/service
---

**Endpoints**

### POST /
- Query: `lat`, `lng`, `serviceName`
- Controller: `ServiceController.listOrganisationByServiceName`
- Response: `400`: keys `message`, `200`: keys `error`

### GET /organisation/:organisationId
- Params: `organisationId`
- Controller: `ServiceController.listByOrganisation`
- Response: `200`: keys `error`

### POST /bookable-slots
- Controller: `ServiceController.getServiceById`

### PATCH /:id
- Params: `id`
- Controller: `ServiceController.deleteService`
