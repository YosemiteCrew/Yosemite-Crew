---
id: backend-api-chat
title: Chat API
slug: /apps/backend/api/chat
---

**Endpoints**

### POST /mobile/token
- Auth: `authorizeCognitoMobile`
- Controller: `ChatController.generateToken`

### POST /mobile/appointments/:appointmentId
- Auth: `authorizeCognitoMobile`
- Params: `appointmentId`
- Controller: `ChatController.ensureAppointmentSession`

### POST /mobile/sessions/:sessionId/open
- Auth: `authorizeCognitoMobile`
- Params: `sessionId`
- Controller: `ChatController.openChat`

### GET /mobile/sessions
- Auth: `authorizeCognitoMobile`
- Controller: `ChatController.listMySessions`

### POST /pms/token
- Auth: `authorizeCognito`
- Controller: `ChatController.generateTokenForPMS`

### POST /pms/appointments/:appointmentId
- Auth: `authorizeCognito`
- Params: `appointmentId`
- Controller: `ChatController.ensureAppointmentSession`

### POST /pms/org/direct
- Auth: `authorizeCognito`
- Controller: `ChatController.createOrgDirectChat`

### POST /pms/org/group
- Auth: `authorizeCognito`
- Controller: `ChatController.createOrgGroupChat`

### POST /pms/sessions/:sessionId/open
- Auth: `authorizeCognito`
- Params: `sessionId`
- Controller: `ChatController.openChat`

### GET /pms/sessions/:organisationId
- Auth: `authorizeCognito`
- Params: `organisationId`
- Controller: `ChatController.listMySessions`

### POST /pms/sessions/:sessionId/close
- Auth: `authorizeCognito`
- Params: `sessionId`
- Controller: `ChatController.closeSession`

### POST /pms/groups/:sessionId/members/add
- Auth: `authorizeCognito`
- Params: `sessionId`
- Controller: `ChatController.addGroupMembers`

### POST /pms/groups/:sessionId/members/remove
- Auth: `authorizeCognito`
- Params: `sessionId`
- Controller: `ChatController.removeGroupMembers`

### PATCH /pms/groups/:sessionId
- Auth: `authorizeCognito`
- Params: `sessionId`
- Controller: `ChatController.updateGroup`

### DELETE /pms/groups/:sessionId
- Auth: `authorizeCognito`
- Params: `sessionId`
- Controller: `ChatController.deleteGroup`
