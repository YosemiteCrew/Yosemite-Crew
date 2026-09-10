---
id: backend-api-marketing-unsubscribe
title: Marketing Unsubscribe API
slug: /apps/backend/api/marketing-unsubscribe
---

Implements the one-click unsubscribe flow for marketing emails, addressed by a signed token embedded in the email link rather than a session. GET only confirms the link and changes nothing; POST performs the unsubscribe. The split matters because mail providers and link scanners fetch every URL in a delivered message, so a mutating GET would let mere delivery unsubscribe the recipient.

**Endpoints**

### GET /unsubscribe

- Query: `token`
- Controller: `MarketingUnsubscribeController.confirm`
- Response: `200`: HTML confirmation page, `400`: keys `message` (invalid/expired token), `500`: keys `message`

### POST /unsubscribe

- Body fields: `token` (also accepted as a query param)
- Controller: `MarketingUnsubscribeController.unsubscribe`
- Response: `200`: HTML success page when the client accepts HTML, otherwise keys `message`; `400`: keys `message` (invalid/expired token); `500`: keys `message`
