---
id: backend-api-mobile.config
title: Mobile.Config API
slug: /apps/backend/api/mobile.config
---

Serves runtime configuration (such as the current environment and app-update settings) that the mobile app fetches on startup. The single route is registered on this router's mount root (`/v1/mobile-config`) rather than a named sub-path.

**Endpoints**

### GET /

- Auth: none (public; mounted at `/v1/mobile-config`)
- Response: `200`: runtime config JSON
- Controller: inline handler
