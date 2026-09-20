---
id: backend-api-parent
title: Parent API
slug: /apps/backend/api/parent
---

Manages parent (pet owner) records and profile-picture uploads, and lists a parent's companions (their pets). The mobile-app routes are authenticated with the pet parent's SuperTokens session (`requireMobileAuth`); the `/pms` routes are called by the PIMS (Practice Information Management System, the clinic-facing web app). See the [Parent Companion API](./parent-companion.md) for links between co-parents.

**Endpoints**

### POST /

- Auth: `requireMobileAuth`
- Controller: `ParentController.getParentMobile`
- Response: `401`: keys `message`, `400`: keys `message`, `source`, `404`: keys `message`, `200`: keys `message`, `500`: keys `message`

### PUT /:id

- Auth: `requireMobileAuth`
- Params: `id`
- Controller: `ParentController.deleteParentMobile`
- Response: `401`: keys `message`, `400`: keys `message`, `source`, `404`: keys `message`, `204`: keys `message`, `500`: keys `message`

### POST /profile/presigned

- Auth: `requireMobileAuth`
- Controller: `ParentController.getProfileUploadUrl`
- Response: `400`: keys `message`, `200`: JSON, `500`: keys `message`

### GET /:parentId/companions

- Auth: `requireMobileAuth`
- Params: `parentId`
- Controller: `CompanionController.getCompanionsByParentId`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### POST /pms/parents

- Auth: `requireWebAuth`
- Controller: `ParentController.getParentPMS`
- Response: `400`: keys `message`, `source`, `404`: keys `message`, `200`: keys `message`, `500`: keys `message`

### PUT /pms/parents/:id

- Auth: `requireWebAuth`
- Params: `id`
- Controller: `ParentController.updateParentPMS`
- Response: `400`: keys `message`, `404`: keys `message`, `200`: keys `message`, `500`: keys `message`

### GET /pms/search

- Auth: `requireWebAuth`
- Query: `name`
- Controller: `ParentController.searchByName`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`
