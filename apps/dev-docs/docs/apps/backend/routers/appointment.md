---
id: backend-api-appointment
title: Appointment API
slug: /apps/backend/api/appointment
---

Covers the appointment lifecycle (request, reschedule, cancel, check-in, accept/reject). Routes under `/mobile` are called by the mobile app on behalf of a pet parent; routes under `/pms` are called by the PIMS (Practice Information Management System, the clinic-facing web app) and require organisation RBAC (role-based access control) permissions.

**Endpoints**

### POST /mobile

- Auth: `authorizeCognitoMobile`
- Body: `AppointmentRequestDTO`
- Controller: `AppointmentController.createRequestedFromMobile`
- Response: `201`: keys `data`, `message`

### GET /mobile/parent

- Auth: `authorizeCognitoMobile`
- Controller: `AppointmentController.listByParent`

### POST /mobile/documentUpload

- Auth: `authorizeCognitoMobile`
- Body: `UploadUrlBody`
- Body fields: `companionId`, `mimeType`
- Controller: `AppointmentController.getDocumentUplaodURL`
- Response: `400`: keys `message`, `200`: JSON, `500`: keys `message`

### GET /mobile/companion/:companionId

- Auth: `authorizeCognitoMobile`
- Params: `companionId`
- Controller: `AppointmentController.listByCompanion`

### PATCH /mobile/:appointmentId/reschedule

- Auth: `authorizeCognitoMobile`
- Params: `appointmentId`
- Body: `RescheduleRequestBody`
- Body fields: `startTime`, `endTime`, `concern`, `isEmergency`
- Controller: `AppointmentController.rescheduleFromMobile`

### PATCH /mobile/:appointmentId/cancel

- Auth: `authorizeCognitoMobile`
- Params: `appointmentId`
- Body: `CancelBody`
- Controller: `AppointmentController.cancelFromMobile`

### PATCH /mobile/:appointmentId/checkin

- Auth: `authorizeCognitoMobile`
- Params: `appointmentId`
- Controller: `AppointmentController.checkInAppointment`

### GET /mobile/:appointmentId

- Auth: `authorizeCognitoMobile`
- Params: `appointmentId`
- Controller: `AppointmentController.getById`

### POST /pms

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Query: `createPayment`
- Body: `AppointmentRequestDTO`
- Controller: `AppointmentController.createFromPms`
- Response: `201`: keys `data`, `message`

### GET /pms/organisation/:organisationId

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `AppointmentController.listByOrganisation`

### GET /pms/organisation/:organisationId/companion/:companionId

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `companionId`
- Controller: `AppointmentController.listByCompanionForOrganisation`

### PATCH /pms/:organisationId/:appointmentId/accept

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `appointmentId`
- Controller: `AppointmentController.acceptRequested`
- Response: `200`: keys `data`, `message`

### PATCH /pms/:organisationId/:appointmentId/reject

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `appointmentId`
- Controller: `AppointmentController.rejectRequested`

### PATCH /pms/:organisationId/:appointmentId/cancel

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `appointmentId`
- Controller: `AppointmentController.cancelFromPMS`

### PATCH /pms/:organisationId/:appointmentId/checkin

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `appointmentId`
- Controller: `AppointmentController.checkInAppointmentForPMS`

### PATCH /pms/:organisationId/:appointmentId

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `appointmentId`
- Body: `AppointmentRequestDTO`
- Controller: `AppointmentController.updateFromPms`

### POST /pms/:organisationId/:appointmentId/forms

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `appointmentId`
- Body: `AttachFormsBody`
- Controller: `AppointmentController.attachFormsToAppointment`

### GET /pms/:organisationId/:appointmentId

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `appointmentId`
- Controller: `AppointmentController.getById`
