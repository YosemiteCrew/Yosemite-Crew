---
id: backend-api-pet-passport-public
title: Pet Passport Public API
slug: /apps/backend/api/pet-passport-public
---

Resolves a pet passport share token — the credential embedded in an Apple/Google Wallet pass QR code — into the assembled passport it represents. This route is public and unauthenticated by design: the credential is the 256-bit share token itself, never the patient id, since the patient id is already exposed to authenticated clients and embedded in app routes and so could be neither rotated nor revoked. Requests are rate-limited to 30 per 15 minutes per IP, and every failure — an unknown, expired, or revoked token — returns the same uniform 404 so the endpoint cannot be probed.

**Endpoints**

### GET /token/:token

- Params: `token`
- Controller: `PetPassportController.getPublicPassportByToken`
- Response: `200`: JSON — the assembled passport; `404`: keys `message` — uniform not-found for any unresolved token
