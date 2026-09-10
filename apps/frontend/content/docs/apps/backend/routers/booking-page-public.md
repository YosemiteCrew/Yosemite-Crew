---
id: backend-api-booking-page-public
title: Booking Page Public API
slug: /apps/backend/api/booking-page-public
---

API routes for the booking page public feature.

**Endpoints**

### POST /requests/confirm

- Auth: `public`
- Rate limit: rate-limited
- Controller: `PublicBookingController`

### GET /:slug

- Auth: `public`
- Rate limit: rate-limited
- Controller: `PublicBookingController`

### GET /:slug/slots

- Auth: `public`
- Rate limit: rate-limited
- Controller: `PublicBookingController`

### POST /:slug/requests

- Auth: `public`
- Rate limit: rate-limited
- Controller: `PublicBookingController`
