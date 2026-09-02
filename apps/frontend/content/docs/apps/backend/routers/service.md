---
id: backend-api-service
title: Service API
slug: /apps/backend/api/service
---

Lets clients discover the services organisations offer: search by service name and location, list an organisation's services, fetch a service's bookable slots, and remove a service.

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
