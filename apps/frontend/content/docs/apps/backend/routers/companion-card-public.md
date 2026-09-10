---
id: backend-api-companion-card-public
title: Companion Card Public API
slug: /apps/backend/api/companion-card-public
---

Resolves a companion card share token minted by the `companion-card` router into the redacted card payload it represents. This route is public and unauthenticated by design — a collar QR code or a referral-clinic link must work for someone with no PIMS (Practice Information Management System) session — so access is gated solely by possession of a valid, unexpired, unrevoked token, and requests are rate-limited to 30 per 15 minutes per IP to blunt enumeration and scraping.

**Endpoints**

### GET /:token

- Params: `token`
- Controller: `CompanionCardController.getByPublicToken`
- Response: `200`: JSON — a card shaped by the token's audience field policy (`identity`, and depending on audience: `passportNumber`, `dateOfBirth`, `alerts`, `ownerContact`, `medical`, `insurance`, `latestVisit`); `404`: keys `message` — a uniform not-found for a missing, expired, or revoked token, so the endpoint cannot be probed to tell those cases apart
