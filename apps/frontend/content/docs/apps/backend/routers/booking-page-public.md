---
id: backend-api-booking-page-public
title: Booking Page Public API
slug: /apps/backend/api/booking-page-public
---

The unauthenticated surface the public booking page itself calls: look up a practice by its booking slug, fetch its open slots, and submit or later confirm a booking request. No session is required by design. Each route sits behind its own per-IP rate limiter — a 60-per-15-minutes budget for the two read routes, and a stricter 10-per-15-minutes budget for the two write routes, since a write can put an email in a stranger's inbox and a row in the clinical database. The practice's own configuration of this page (which services are bookable, the booking window, auto-confirm) is set through the sibling authenticated `booking-page` router.

**Endpoints**

### POST /requests/confirm

- Body fields: `token`
- Controller: `PublicBookingController.confirmRequest`
- Response: `200`: keys `data`

### GET /:slug

- Params: `slug`
- Controller: `PublicBookingController.getPractice`
- Response: `200`: keys `data` — either the practice's public profile, or `{ redirectTo: <newSlug> }` when the requested slug has been retired

### GET /:slug/slots

- Params: `slug`
- Query: `serviceId`, `date`
- Controller: `PublicBookingController.getSlots`

### POST /:slug/requests

- Params: `slug`
- Body: `RequestSchema`
- Body fields: `serviceId`, `date`, `startTime`, `ownerName`, `ownerEmail`, `ownerPhone`, `petName`, `petSpecies`, `concern`, `consent`
- Controller: `PublicBookingController.submitRequest`
- Response: `202`: keys `message` — nothing is booked yet; the requester must follow the confirmation link emailed to them
