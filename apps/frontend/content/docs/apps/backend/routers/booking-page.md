---
id: backend-api-booking-page
title: Booking Page API
slug: /apps/backend/api/booking-page
---

API routes for the booking page feature.

**Endpoints**

### GET /:organisationId

- Auth: `requireWebAuth`
- Permission: `teams:view:any`
- Controller: `BookingPageController`

### PUT /:organisationId

- Auth: `requireWebAuth`
- Permission: `teams:edit:any`
- Controller: `BookingPageController`

### GET /:organisationId/requests

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `BookingPageController`

### PATCH /:organisationId/requests/:requestId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `BookingPageController`
