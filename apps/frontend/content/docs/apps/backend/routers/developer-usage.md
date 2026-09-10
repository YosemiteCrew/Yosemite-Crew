---
id: backend-api-developer-usage
title: Developer Usage API
slug: /apps/backend/api/developer-usage
---

Reports API call usage and quota for the current billing period, for a developer viewing their own account in the developer portal. This is a session-authenticated route (the portal user's own login), not the API-key data plane used by third-party integrations. It is deliberately gated on `requireWebAuth` alone with no organisation or role check: a developer-portal signup creates no `UserOrganization` row, so `withOrgPermissions()` would 400 every request before it reached the handler (issue #2551). The handler scopes the query to the caller's own session-verified id, so the response can only ever describe the caller's own usage.

**Endpoints**

### GET /

- Auth: `requireWebAuth`, `requireActiveAccount()`
- Query: `period`
- Controller: `DeveloperUsageController.getUsage`
- Response: `200`: keys `data` (`billingPeriod`, `callCount`, `limit`), `401`: keys `error`, `500`: keys `error`
