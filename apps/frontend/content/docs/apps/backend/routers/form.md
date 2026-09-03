---
id: backend-api-form
title: Form API
slug: /apps/backend/api/form
---

Manages clinical and consent forms, form submissions, and signing, including SOAP notes (the Subjective, Objective, Assessment, Plan structure vets use to record a visit). Routes under `/admin` and the signing routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and require organisation RBAC (role-based access control) permissions; routes under `/mobile` and `/public` are called by the mobile app (pet parents).

**Endpoints**

### POST /admin/:orgId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `orgId`
- Controller: `FormController.createForm`
- Response: `401`: keys `Unauthorized`, `message`, `201`: keys `message`, `500`: keys `message`

### GET /admin/:orgId/forms

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `orgId`
- Controller: `FormController.getFormListForOrganisation`
- Response: `200`: keys `message`, `500`: keys `message`

### GET /admin/:orgId/:formId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `orgId`, `formId`
- Controller: `FormController.getFormForAdmin`
- Response: `200`: keys `message`, `500`: keys `message`

### PUT /admin/:orgId/:formId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `orgId`, `formId`
- Controller: `FormController.updateForm`
- Response: `401`: keys `Unauthorized`, `message`, `200`: keys `message`, `500`: keys `message`

### POST /admin/:formId/publish

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `formId`
- Controller: `FormController.publishForm`
- Response: `401`: keys `Unauthorized`, `message`, `200`: keys `message`, `500`: keys `message`

### POST /admin/:formId/unpublish

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `formId`
- Controller: `FormController.unpublishForm`
- Response: `401`: keys `Unauthorized`, `message`, `200`: keys `message`, `500`: keys `message`

### POST /admin/:formId/archive

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `formId`
- Controller: `FormController.archiveForm`
- Response: `401`: keys `Unauthorized`, `message`, `200`: keys `message`, `500`: keys `message`

### POST /admin/:formId/submit

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `formId`
- Controller: `FormController.submitFormFromPMS`
- Response: `201`: keys `message`, `500`: keys `message`

### GET /appointments/:appointmentId/soap-notes

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `appointmentId`
- Query: `latestOnly`
- Controller: `FormController.getSOAPNotesByAppointment`
- Response: `200`: keys `message`, `500`: keys `message`

### GET /appointments/:appointmentId/forms

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `appointmentId`
- Query: `isPMS`, `serviceId`, `species`
- Controller: `FormController.getFormsForAppointment`
- Response: `400`: keys `isPMS`, `message`, `serviceId`, `species`, `200`: keys `message`, `500`: keys `message`

### POST /form-submissions/:submissionId/sign

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `submissionId`
- Controller: `FormSigningController.startSigning`
- Response: `200`: keys `err`, `message`, `400`: JSON

### GET /form-submissions/:submissionId/signed-document

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `submissionId`
- Controller: `FormSigningController.getSignedDocument`
- Response: `200`: keys `err`, `message`, `400`: JSON

### GET /public/:formId

- Auth: `none`
- Params: `formId`
- Controller: `FormController.submitForm`
- Response: `401`: keys `Unauthorized`, `message`, `201`: keys `message`, `500`: keys `message`

### GET /mobile/submissions/:formId

- Auth: `requireMobileAuth`
- Params: `formId`
- Controller: `FormController.getFormSubmissions`
- Response: `200`: keys `message`, `500`: keys `message`

### GET /mobile/forms/:formId/submissions

- Auth: `requireMobileAuth`
- Params: `formId`
- Controller: `FormController.listFormSubmissions`
- Response: `200`: keys `message`, `500`: keys `message`

### GET /mobile/forms/:organizationId/:serivceId/consent-form

- Auth: `requireMobileAuth`
- Params: `organizationId`, `serivceId`
- Query: `species`
- Controller: `FormController.getConsentFormForParent`
- Response: `200`: keys `message`, `500`: keys `message`

### GET /mobile/appointments/:appointmentId/soap-notes

- Auth: `requireMobileAuth`
- Params: `appointmentId`
- Query: `latestOnly`
- Controller: `FormController.getSOAPNotesByAppointment`
- Response: `200`: keys `message`, `500`: keys `message`

### GET /mobile/appointments/:appointmentId/forms

- Auth: `requireMobileAuth`
- Params: `appointmentId`
- Query: `isPMS`, `serviceId`, `species`
- Controller: `FormController.getFormsForAppointment`
- Response: `400`: keys `isPMS`, `message`, `serviceId`, `species`, `200`: keys `message`, `500`: keys `message`

### GET /mobile/form-submissions/:submissionId/pdf

- Auth: `requireMobileAuth`
- Params: `submissionId`
- Controller: `FormController.getFormSubmissionPDF`
- Response: `500`: keys `message`

### POST /mobile/form-submissions/:submissionId/sign

- Auth: `requireMobileAuth`
- Params: `submissionId`
- Controller: `FormSigningController.startSigningMobile`
- Response: `200`: keys `err`, `message`, `400`: JSON
