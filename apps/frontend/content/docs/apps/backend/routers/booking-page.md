---
id: backend-api-booking-page
title: Booking Page API
slug: /apps/backend/api/booking-page
---

Authenticated configuration surface the PIMS (Practice Information Management System, the clinic-facing web app) uses to set up a practice's public booking page and to triage the booking requests that arrive from it; the anonymous booking flow itself is the sibling `booking-page-public` router. Gated by RBAC (role-based access control): publishing or editing the page configuration needs the `teams` permission pair — the same one that gates the organisation's public profile — while listing and actioning booking requests needs the `appointments` pair, since triaging a request into the diary is clinical scheduling work rather than organisation administration. Every handler scopes to the organisation the caller's session was actually authorized for, never to the `:organisationId` route param directly.

**Endpoints**

### GET /:organisationId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `BookingPageController.getConfig`
- Response: `200`: keys `data`

### PUT /:organisationId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `SettingsSchema`
- Body fields: `serviceIds`, `bookingWindowDays`, `bufferMinutes`, `autoConfirm`, `welcomeMessage`, `replyToEmail`, `publicBookingEnabled`
- Controller: `BookingPageController.saveConfig`
- Response: `200`: keys `data`, `400`: keys `message`

### GET /:organisationId/requests

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `status`
- Controller: `BookingPageController.listRequests`
- Response: `200`: keys `data`

### PATCH /:organisationId/requests/:requestId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `requestId`
- Body: `RequestStatusSchema`
- Body fields: `status` (`"DECLINED"` or `"BOOKED"` — a request can only be declined or marked booked here, not moved back to confirmed)
- Controller: `BookingPageController.updateRequestStatus`
- Response: `200`: keys `message`
