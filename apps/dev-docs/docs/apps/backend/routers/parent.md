---
id: backend-api-parent
title: Parent API
slug: /apps/backend/api/parent
---

**Endpoints**

### POST /
- Auth: `authorizeCognitoMobile`
- Controller: `ParentController.getParentMobile`
- Response: `401`: keys `message`, `400`: keys `message`, `source`, `404`: keys `message`, `200`: keys `message`, `500`: keys `message`

### PUT /:id
- Auth: `authorizeCognitoMobile`
- Params: `id`
- Controller: `ParentController.deleteParentMobile`
- Response: `401`: keys `message`, `400`: keys `message`, `source`, `404`: keys `message`, `204`: keys `message`, `500`: keys `message`

### POST /profile/presigned
- Auth: `authorizeCognitoMobile`
- Controller: `ParentController.getProfileUploadUrl`
- Response: `400`: keys `message`, `200`: JSON, `500`: keys `message`

### GET /:parentId/companions
- Auth: `authorizeCognitoMobile`
- Params: `parentId`
- Controller: `CompanionController.getCompanionsByParentId`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### POST /pms/parents
- Auth: `authorizeCognito`
- Controller: `ParentController.getParentPMS`
- Response: `400`: keys `message`, `source`, `404`: keys `message`, `200`: keys `message`, `500`: keys `message`

### PUT /pms/parents/:id
- Auth: `authorizeCognito`
- Params: `id`
- Controller: `ParentController.updateParentPMS`
- Response: `400`: keys `message`, `404`: keys `message`, `200`: keys `message`, `500`: keys `message`

### GET /pms/search
- Auth: `authorizeCognito`
- Query: `name`
- Controller: `ParentController.searchByName`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`
