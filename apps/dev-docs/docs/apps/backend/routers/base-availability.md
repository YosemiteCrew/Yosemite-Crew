---
id: backend-api-base-availability
title: Base Availability API
slug: /apps/backend/api/base-availability
---

Stores and retrieves a single user's base (default weekly) availability. See the [Availability API](./availability.md) for the organisation-wide scheduling endpoints that build on this.

**Endpoints**

### POST /

- Controller: `BaseAvailabilityController.update`
- Response: `200`: keys `error`, `message`, `500`: keys `message`

### GET /:userId

- Params: `userId`
- Controller: `BaseAvailabilityController.getByUserId`
- Response: `404`: keys `message`, `200`: keys `error`, `message`, `500`: keys `message`
