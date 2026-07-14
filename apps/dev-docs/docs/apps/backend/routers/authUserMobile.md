---
id: backend-api-authUserMobile
title: Authusermobile API
slug: /apps/backend/api/authUserMobile
---

Handles user signup for the mobile app. The endpoint is guarded by the mobile auth middleware (`authorizeCognitoMobile`) and creates the backend user record for an authenticated mobile account.

**Endpoints**

### POST /signup

- Auth: `authorizeCognitoMobile`
- Controller: `AuthUserMobileController.signup`
