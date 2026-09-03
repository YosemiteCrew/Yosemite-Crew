---
id: backend-api-deviceToken
title: Devicetoken API
slug: /apps/backend/api/deviceToken
---

Registers and unregisters push-notification device tokens. Called by the mobile app so the backend can deliver push notifications to a signed-in user's device.

**Endpoints**

### POST /register

- Auth: `requireMobileAuth`
- Controller: `DeviceTokenController.registerDeviceToken`

### POST /unregister

- Auth: `requireMobileAuth`
- Controller: `DeviceTokenController.unregisterDeviceToken`
