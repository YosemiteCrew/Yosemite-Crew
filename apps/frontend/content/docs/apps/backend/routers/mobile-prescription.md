---
id: backend-api-mobile-prescription
title: Mobile Prescription API
slug: /apps/backend/api/mobile-prescription
---

Lets a signed-in pet parent list the prescriptions for their companions from the mobile app, using keyset (cursor-based) pagination.

**Endpoints**

### GET /mobile

- Auth: `requireMobileAuth`
- Query: `cursor?`, `limit?`
- Controller: `MobilePrescriptionController.listPrescriptions`
- Response: `200`: keys `prescriptions`, `nextCursor`, `hasMore`, `limit`; `400`: keys `message` (malformed cursor); `401`: keys `message` (not authenticated); `404`: keys `message` (auth user has no linked parent record); `500`: keys `message`
