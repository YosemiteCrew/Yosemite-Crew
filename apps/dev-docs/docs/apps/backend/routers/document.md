---
id: backend-api-document
title: Document API
slug: /apps/backend/api/document
---

**Endpoints**

### POST /mobile/upload-url
- Auth: `authorizeCognitoMobile`
- Body: `UploadUrlBody`
- Body fields: `companionId`, `mimeType`
- Controller: `DocumentController.getUploadUrl`
- Response: `400`: keys `message`, `200`: JSON, `500`: keys `message`

### POST /mobile/:companionId
- Auth: `authorizeCognitoMobile`
- Params: `companionId`
- Body: `DocumentRequestBody`
- Body fields: `title`, `category`, `subcategory`, `attachments`, `appointmentId`, `visitType`, `issuingBusinessName`, `issueDate`
- Controller: `DocumentController.createDocument`

### GET /mobile/:companionId
- Auth: `authorizeCognitoMobile`
- Params: `companionId`
- Controller: `DocumentController.listDocumentsForParent`

### PATCH /mobile/details/:id
- Auth: `authorizeCognitoMobile`
- Params: `id`
- Body: `Partial<DocumentRequestBody`
- Controller: `DocumentController.updateDocument`
- Response: `401`: keys `message`, `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### GET /mobile/appointments/:appointmentId
- Auth: `authorizeCognitoMobile`
- Params: `appointmentId`
- Controller: `DocumentController.listForAppointment`

### GET /mobile/view/:documentId
- Auth: `authorizeCognitoMobile`
- Params: `documentId`
- Controller: `DocumentController.getDocumentDownloadUrl`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### POST /mobile/view
- Auth: `authorizeCognitoMobile`
- Body: `SignedDownloadUrlBody`
- Body fields: `key`
- Controller: `DocumentController.getSignedDownloadUrl`
- Response: `400`: keys `message`, `200`: JSON, `500`: keys `message`

### DELETE /mobile/:documentId
- Auth: `authorizeCognitoMobile`
- Params: `documentId`
- Controller: `DocumentController.deleteForParent`

### GET /search/:companionId
- Auth: `authorizeCognitoMobile`
- Params: `companionId`
- Query: `title`
- Controller: `DocumentController.searchDocument`
- Response: `400`: keys `companionId`, `message`, `title`, `200`: keys `documents`, `message`, `500`: keys `message`

### POST /pms/upload-url
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Body: `UploadUrlBody`
- Body fields: `companionId`, `mimeType`
- Controller: `DocumentController.getUploadUrl`
- Response: `400`: keys `message`, `200`: JSON, `500`: keys `message`

### POST /pms/:companionId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `companionId`
- Body: `DocumentRequestBody`
- Body fields: `title`, `category`, `subcategory`, `attachments`, `appointmentId`, `visitType`, `issuingBusinessName`, `issueDate`
- Controller: `DocumentController.createDocumentPms`

### GET /pms/:companionId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `companionId`
- Controller: `DocumentController.listForPms`

### GET /pms/details/:documentId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `documentId`
- Controller: `DocumentController.getForPms`

### PATCH /pms/details/:documentId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `documentId`
- Body: `Partial<DocumentRequestBody`
- Controller: `DocumentController.updateDocument`
- Response: `401`: keys `message`, `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### GET /pms/view/:documentId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `documentId`
- Controller: `DocumentController.getDocumentDownloadUrl`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### POST /pms/view
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Body: `SignedDownloadUrlBody`
- Body fields: `key`
- Controller: `DocumentController.getSignedDownloadUrl`
- Response: `400`: keys `message`, `200`: JSON, `500`: keys `message`

### GET /pms/appointments/:appointmentId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `appointmentId`
- Controller: `DocumentController.listForAppointment`
