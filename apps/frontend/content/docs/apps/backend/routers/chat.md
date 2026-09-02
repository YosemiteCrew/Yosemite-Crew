---
id: backend-api-chat
title: Chat API
slug: /apps/backend/api/chat
---

Provides messaging: chat tokens, appointment-linked sessions, and organisation direct/group chats. Routes under `/mobile` are called by the mobile app (pet parents); routes under `/pms` are called by the PIMS (Practice Information Management System, the clinic-facing web app) and additionally manage group membership.

**Endpoints**

### POST /mobile/token

- Auth: `requireMobileAuth`
- Controller: `ChatController.generateToken`

### POST /mobile/appointments/:appointmentId

- Auth: `requireMobileAuth`
- Params: `appointmentId`
- Controller: `ChatController.ensureAppointmentSession`

### POST /mobile/sessions/:sessionId/open

- Auth: `requireMobileAuth`
- Params: `sessionId`
- Controller: `ChatController.openChat`

### GET /mobile/sessions

- Auth: `requireMobileAuth`
- Controller: `ChatController.listMySessions`

### POST /pms/token

- Auth: `requireWebAuth`
- Controller: `ChatController.generateTokenForPMS`

### POST /pms/appointments/:appointmentId

- Auth: `requireWebAuth`
- Params: `appointmentId`
- Controller: `ChatController.ensureAppointmentSession`

### POST /pms/org/direct

- Auth: `requireWebAuth`
- Controller: `ChatController.createOrgDirectChat`

### POST /pms/org/group

- Auth: `requireWebAuth`
- Controller: `ChatController.createOrgGroupChat`

### POST /pms/sessions/:sessionId/open

- Auth: `requireWebAuth`
- Params: `sessionId`
- Controller: `ChatController.openChat`

### GET /pms/sessions/:organisationId

- Auth: `requireWebAuth`
- Params: `organisationId`
- Controller: `ChatController.listMySessions`

### POST /pms/sessions/:sessionId/close

- Auth: `requireWebAuth`
- Params: `sessionId`
- Controller: `ChatController.closeSession`

### POST /pms/groups/:sessionId/members/add

- Auth: `requireWebAuth`
- Params: `sessionId`
- Controller: `ChatController.addGroupMembers`

### POST /pms/groups/:sessionId/members/remove

- Auth: `requireWebAuth`
- Params: `sessionId`
- Controller: `ChatController.removeGroupMembers`

### PATCH /pms/groups/:sessionId

- Auth: `requireWebAuth`
- Params: `sessionId`
- Controller: `ChatController.updateGroup`

### DELETE /pms/groups/:sessionId

- Auth: `requireWebAuth`
- Params: `sessionId`
- Controller: `ChatController.deleteGroup`
