---
id: backend-api-notification
title: Notification API
slug: /apps/backend/api/notification
---

**Endpoints**

### GET /mobile
- Auth: `authorizeCognitoMobile`
- Controller: `NotificationController.listNotifications`
- Response: `401`: keys `authenticated`, `message`, `404`: keys `message`, `200`: JSON, `500`: keys `message`

### POST /mobile/:notificationId/seen
- Auth: `authorizeCognitoMobile`
- Params: `notificationId`
- Controller: `NotificationController.markAsSeen`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`
