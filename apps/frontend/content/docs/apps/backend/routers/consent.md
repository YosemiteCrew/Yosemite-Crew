---
id: backend-api-consent
title: Consent API
slug: /apps/backend/api/consent
---

Relays a visitor's cookie-consent banner decision from the public web app to the SuperAdmin panel's append-only consent ledger, which is the durable record — the product app keeps none of its own. The route is reachable without a session, since the banner can fire before sign-in; when a session happens to be present it is attached and the decision is linked to the verified user, but this is enrichment only and never required. The forward to the panel runs off the request path, and the response is always `202` regardless of whether that forward succeeds, so a down or unconfigured SuperAdmin panel never blocks the visitor. Requests are rate-limited to 60 per 15 minutes per IP.

**Endpoints**

### POST /

- Auth: `attachSessionIfPresent`
- Body fields: `consentId`, `granted`
- Controller: `ConsentController.reportWebDecision`
- Response: `202`: keys `ok`; `400`: keys `message`
