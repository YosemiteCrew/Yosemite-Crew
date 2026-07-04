---
id: backend-api-parent-companion
title: Parent Companion API
slug: /apps/backend/api/parent-companion
---

Manages the links between parents (pet owners) and companions (the pets, also shown as animal, pet, or patient depending on the clinic's preference): listing links, updating a co-parent's permissions, promoting a co-parent to primary, and removing a co-parent. All routes are called by the mobile app and authenticated with the mobile Cognito user pool. See the [Parent API](./parent.md) for parent records.

**Endpoints**

### GET /parent/:parentId

- Auth: `authorizeCognitoMobile`
- Params: `parentId`
- Controller: `ParentCompanionController.getLinksForParent`
- Response: `400`: keys `message`, `200`: JSON, `500`: keys `message`

### GET /companion/:companionId

- Auth: `authorizeCognitoMobile`
- Params: `companionId`
- Controller: `ParentCompanionController.getLinksForCompanion`
- Response: `400`: keys `message`, `200`: JSON, `500`: keys `message`

### PATCH /:companionId/:targetParentId/permissions

- Auth: `authorizeCognitoMobile`
- Params: `companionId`, `targetParentId`
- Controller: `ParentCompanionController.updatePermissions`
- Response: `401`: keys `message`, `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### POST /:companionId/:targetParentId/promote

- Auth: `authorizeCognitoMobile`
- Params: `companionId`, `targetParentId`
- Controller: `ParentCompanionController.promoteToPrimary`
- Response: `401`: keys `message`, `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### DELETE /:companionId/:coParentId

- Auth: `authorizeCognitoMobile`
- Params: `companionId`, `coParentId`
- Controller: `ParentCompanionController.removeCoParent`
- Response: `401`: keys `message`, `400`: keys `message`, `204`: keys `message`, `500`: keys `message`
