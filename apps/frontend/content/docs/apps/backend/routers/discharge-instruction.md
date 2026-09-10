---
id: backend-api-discharge-instruction
title: Discharge Instruction API
slug: /apps/backend/api/discharge-instruction
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/discharge-instructions

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `DischargeInstructionController`

### POST /pms/organisation/:organisationId/discharge-instructions

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `DischargeInstructionController`

### GET /pms/organisation/:organisationId/discharge-instructions/:dischargeId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `DischargeInstructionController`

### PUT /pms/organisation/:organisationId/discharge-instructions/:dischargeId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `DischargeInstructionController`

### POST /pms/organisation/:organisationId/discharge-instructions/:dischargeId/send

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `DischargeInstructionController`

### POST /pms/organisation/:organisationId/discharge-instructions/:dischargeId/acknowledge

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `DischargeInstructionController`
