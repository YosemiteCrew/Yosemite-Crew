---
id: backend-api-form-assignment
title: Form Assignment API
slug: /apps/backend/api/form-assignment
---

API routes for the form assignment feature.

**Endpoints**

### POST /organisations/:organisationId/appointments/:appointmentId/assignments

- Auth: `requireWebAuth`
- Permission: `forms:edit:any`
- Controller: `FormAssignmentController`

### GET /organisations/:organisationId/appointments/:appointmentId/assignments

- Auth: `requireWebAuth`
- Permission: `forms:view:any`
- Controller: `FormAssignmentController`

### GET /organisations/:organisationId/assignments

- Auth: `requireWebAuth`
- Permission: `forms:view:any`
- Controller: `FormAssignmentController`

### GET /organisations/:organisationId/assignments

- Auth: `requireWebAuth`
- Permission: `forms:view:any`
- Controller: `FormAssignmentController`

### GET /organisations/:organisationId/companions/:companionId/assignments

- Auth: `requireWebAuth`
- Permission: `forms:view:any`
- Controller: `FormAssignmentController`

### POST /String

- Auth: `requireWebAuth`
- Permission: `forms:edit:any`
- Controller: `FormAssignmentController`

### POST /String

- Auth: `requireWebAuth`
- Permission: `forms:edit:any`
- Controller: `FormAssignmentController`
