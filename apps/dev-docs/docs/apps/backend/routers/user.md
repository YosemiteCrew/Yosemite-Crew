---
id: backend-api-user
title: User API
slug: /apps/backend/api/user
---

**Endpoints**

### POST /
- Auth: `authorizeCognito`
- Controller: `UserController.getById`
- Response: `404`: keys `message`, `200`: keys `error`, `message`, `500`: keys `message`

### DELETE /:id
- Auth: `authorizeCognito`
- Params: `id`
- Body: `JSON`
- Body fields: `firstName`, `lastName`
- Controller: `UserController.updateName`
- Response: `401`: keys `message`, `400`: keys `message`, `200`: keys `error`, `message`, `500`: keys `message`
