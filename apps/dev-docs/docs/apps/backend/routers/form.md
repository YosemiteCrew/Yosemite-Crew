---
id: backend-api-form
title: Form API
slug: /apps/backend/api/form
---

**Endpoints**

### POST /admin/:orgId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `orgId`
- Controller: `FormController.createForm`
- Response: `401`: keys `Unauthorized`, `message`, `201`: keys `message`, `500`: keys `message`

### GET /admin/:orgId/forms
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `orgId`
- Controller: `FormController.getFormListForOrganisation`
- Response: `200`: keys `message`, `500`: keys `message`

### GET /admin/:orgId/:formId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `orgId`, `formId`
- Controller: `FormController.getFormForAdmin`
- Response: `200`: keys `message`, `500`: keys `message`

### PUT /admin/:orgId/:formId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `orgId`, `formId`
- Controller: `FormController.updateForm`
- Response: `401`: keys `Unauthorized`, `message`, `200`: keys `message`, `500`: keys `message`

### POST /admin/:formId/publish
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `formId`
- Controller: `FormController.publishForm`
- Response: `401`: keys `Unauthorized`, `message`, `200`: keys `message`, `500`: keys `message`

### POST /admin/:formId/unpublish
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `formId`
- Controller: `FormController.unpublishForm`
- Response: `401`: keys `Unauthorized`, `message`, `200`: keys `message`, `500`: keys `message`

### POST /admin/:formId/archive
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `formId`
- Controller: `FormController.archiveForm`
- Response: `401`: keys `Unauthorized`, `message`, `200`: keys `message`, `500`: keys `message`

### POST /admin/:formId/submit
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `formId`
- Controller: `FormController.submitFormFromPMS`
- Response: `201`: keys `message`, `500`: keys `message`

### GET /appointments/:appointmentId/soap-notes
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `appointmentId`
- Query: `latestOnly`
- Controller: `FormController.getSOAPNotesByAppointment`
- Response: `200`: keys `message`, `500`: keys `message`

### GET /appointments/:appointmentId/forms
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `appointmentId`
- Query: `isPMS`, `serviceId`, `species`
- Controller: `FormController.getFormsForAppointment`
- Response: `400`: keys `isPMS`, `message`, `serviceId`, `species`, `200`: keys `message`, `500`: keys `message`

### POST /form-submissions/:submissionId/sign
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `submissionId`
- Controller: `FormSigningController.startSigning`
- Response: `200`: keys `err`, `message`, `400`: JSON

### GET /form-submissions/:submissionId/signed-document
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `submissionId`
- Controller: `FormSigningController.getSignedDocument`
- Response: `200`: keys `err`, `message`, `400`: JSON

### GET /public/:formId
- Auth: `authorizeCognitoMobile`
- Params: `formId`
- Controller: `FormController.submitForm`
- Response: `401`: keys `Unauthorized`, `message`, `201`: keys `message`, `500`: keys `message`

### GET /mobile/submissions/:formId
- Auth: `authorizeCognitoMobile`
- Params: `formId`
- Controller: `FormController.getFormSubmissions`
- Response: `200`: keys `message`, `500`: keys `message`

### GET /mobile/forms/:formId/submissions
- Auth: `authorizeCognitoMobile`
- Params: `formId`
- Controller: `FormController.listFormSubmissions`
- Response: `200`: keys `message`, `500`: keys `message`

### GET /mobile/forms/:organizationId/:serivceId/consent-form
- Auth: `authorizeCognitoMobile`
- Params: `organizationId`, `serivceId`
- Query: `species`
- Controller: `FormController.getConsentFormForParent`
- Response: `200`: keys `message`, `500`: keys `message`

### GET /mobile/appointments/:appointmentId/soap-notes
- Auth: `authorizeCognitoMobile`
- Params: `appointmentId`
- Query: `latestOnly`
- Controller: `FormController.getSOAPNotesByAppointment`
- Response: `200`: keys `message`, `500`: keys `message`

### GET /mobile/appointments/:appointmentId/forms
- Auth: `authorizeCognitoMobile`
- Params: `appointmentId`
- Query: `isPMS`, `serviceId`, `species`
- Controller: `FormController.getFormsForAppointment`
- Response: `400`: keys `isPMS`, `message`, `serviceId`, `species`, `200`: keys `message`, `500`: keys `message`

### GET /mobile/form-submissions/:submissionId/pdf
- Auth: `authorizeCognitoMobile`
- Params: `submissionId`
- Controller: `FormController.getFormSubmissionPDF`
- Response: `500`: keys `message`

### POST /mobile/form-submissions/:submissionId/sign
- Auth: `authorizeCognitoMobile`
- Params: `submissionId`
- Controller: `FormSigningController.startSigningMobile`
- Response: `200`: keys `err`, `message`, `400`: JSON
