---
id: backend-api-user-organization
title: User Organization API
slug: /apps/backend/api/user-organization
---

Manages the mappings between users and the organisations they belong to: listing a user's memberships, listing the members of an organisation, and updating or removing a mapping. See the [User API](./user.md) and [Organization API](./organization.md) for the records these mappings connect.

**Endpoints**

### POST /

- Auth: `authorizeCognito`
- Controller: `UserOrganizationController.listMappingsForUser`
- Response: `401`: keys `Unauthorized`, `message`, `200`: keys `message`, `500`: keys `message`

### GET /org/mapping/:organisationId

- Auth: `authorizeCognito`
- Params: `organisationId`
- Controller: `UserOrganizationController.listByOrganisationId`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### GET /:id

- Params: `id`
- Controller: `UserOrganizationController.listMappings`
- Response: `200`: JSON, `500`: keys `message`

### DELETE /:id

- Params: `id`
- Controller: `UserOrganizationController.updateMappingById`
- Response: `400`: keys `message`, `404`: keys `message`, `200`: keys `message`, `500`: keys `message`
