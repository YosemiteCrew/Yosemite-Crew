---
id: backend-api-pathology-submission
title: Pathology Submission API
slug: /apps/backend/api/pathology-submission
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/pathology-submissions

- Auth: `requireWebAuth`
- Permission: `labs:view:any`
- Controller: `PathologySubmissionController`

### POST /pms/organisation/:organisationId/pathology-submissions

- Auth: `requireWebAuth`
- Permission: `labs:edit:any`
- Controller: `PathologySubmissionController`

### GET /pms/organisation/:organisationId/pathology-submissions/:submissionId

- Auth: `requireWebAuth`
- Permission: `labs:view:any`
- Controller: `PathologySubmissionController`

### PUT /pms/organisation/:organisationId/pathology-submissions/:submissionId

- Auth: `requireWebAuth`
- Permission: `labs:edit:any`
- Controller: `PathologySubmissionController`

### POST /pms/organisation/:organisationId/pathology-submissions/:submissionId/results

- Auth: `requireWebAuth`
- Permission: `labs:edit:any`
- Controller: `PathologySubmissionController`

### POST /pms/organisation/:organisationId/pathology-submissions/:submissionId/review

- Auth: `requireWebAuth`
- Permission: `labs:edit:any`
- Controller: `PathologySubmissionController`
