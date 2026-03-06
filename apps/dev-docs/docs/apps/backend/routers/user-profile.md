---
id: backend-api-user-profile
title: User Profile API
slug: /apps/backend/api/user-profile
---

**Endpoints**

### POST /:organizationId/profile
- Auth: `authorizeCognito`
- Params: `organizationId`
- Controller: `UserProfileController.create`
- Response: `201`: keys `error`, `message`, `500`: keys `message`

### PUT /:organizationId/profile
- Auth: `authorizeCognito`
- Params: `organizationId`
- Controller: `UserProfileController.update`
- Response: `404`: keys `message`, `200`: keys `error`, `message`, `500`: keys `message`

### GET /:organizationId/profile
- Auth: `authorizeCognito`
- Params: `organizationId`
- Controller: `UserProfileController.getByUserId`
- Response: `404`: keys `message`, `200`: keys `error`, `message`, `500`: keys `message`

### GET /:userId/:organizationId/profile
- Auth: `authorizeCognito`
- Params: `userId`, `organizationId`
- Controller: `UserProfileController.getUserProfileById`
- Response: `404`: keys `message`, `200`: keys `error`, `message`, `500`: keys `message`

### POST /:organizationId/profile-picture
- Auth: `authorizeCognito`
- Params: `organizationId`
- Controller: `UserProfileController.getProfilePictureUploadUrl`
- Response: `400`: keys `message`, `200`: keys `s3Key`, `uploadUrl`, `500`: keys `message`
