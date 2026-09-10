---
id: backend-api-developer-data
title: Developer Data API
slug: /apps/backend/api/developer-data
---

The API-key authenticated developer data plane — the REST surface backing the `@yosemite-crew/mcp-server` MCP (Model Context Protocol) tools (`list_organizations`, `get_usage`, `list_appointments`, `get_appointment`), so an external developer or agent can read a practice's data with a `DeveloperApiKey` instead of a browser session. A key identifies a person, not a practice: `authorizeApiKey` verifies the presented key (`Authorization: Bearer yc_…` or an `X-API-Key` header), meters the call, and binds the caller's id, but every organisation-scoped route still requires an `x-org-id` header naming the target practice, re-checked against the owner's live, active membership on every request — `GET /organizations` is how a key holder discovers which ids they may use there. A key over its monthly quota gets a `429` from `authorizeApiKey` before any handler runs. Handler-level errors use a `{ message, code }` envelope with a closed set of `code` values: `invalid_request`, `missing_api_key`, `not_found`, `internal_error`.

**Endpoints**

### GET /organizations

- Auth: `authorizeApiKey`
- Controller: `DeveloperDataController.listOrganizations`
- Response: `200`: keys `data` — practices the key's owner actively belongs to, each with `id`, `name`, `type`, `roleCode`, `roleDisplay`; `401`: keys `message`, `code`

### GET /usage

- Auth: `authorizeApiKey`
- Controller: `DeveloperDataController.getUsage`
- Response: `200`: keys `data` — `billingPeriod`, `callCount`, `limit` (`limit` is `null` off the free plan); `401`: keys `message`, `code`

### GET /appointments

- Auth: `authorizeApiKey`
- RBAC: `requireScope, withOrgPermissions, requirePermission`
- Query: `from`, `to`, `status`, `limit`, `cursor`
- Controller: `DeveloperDataController.listAppointments`
- Response: `200`: keys `data`, `pagination`; `400`: keys `message`, `code` — invalid `from`/`to`, `status`, or `cursor`

### GET /appointments/:appointmentId

- Auth: `authorizeApiKey`
- RBAC: `requireScope, withAppointmentOrgPermissions, requirePermission`
- Params: `appointmentId`
- Controller: `DeveloperDataController.getAppointment`
- Response: `200`: keys `data`; `404`: keys `message`, `code`
