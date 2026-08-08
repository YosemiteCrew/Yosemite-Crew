---
id: backend-api-authUserMobile
title: Authusermobile API
slug: /apps/backend/api/authUserMobile
---

Handles user signup for the mobile app. The endpoint is guarded by the mobile auth middleware (`requireMobileAuth`) and creates the backend user record for an authenticated mobile account.

**Endpoints**

### POST /signup

- Auth: `requireMobileAuth`
- Controller: `AuthUserMobileController.signup`
