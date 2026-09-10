---
id: backend-api-parasite-risk
title: Parasite Risk API
slug: /apps/backend/api/parasite-risk
---

Serves modelled parasite risk to the mobile app: a risk reading for the grid cell containing a coordinate, plus the locations a pet parent has subscribed to for alerts. All routes are mobile-only and scoped to the authenticated pet parent (resolved from the auth user's linked parent record) — there is no PIMS (Practice Information Management System) or organisation surface.

**Endpoints**

### GET /

- Auth: `requireMobileAuth`
- Query: `lat`, `lon`, `countryCode?`
- Controller: `ParasiteRiskController.getRiskForCell`

### GET /subscriptions

- Auth: `requireMobileAuth`
- Controller: `ParasiteRiskController.listSubscriptions`

### POST /subscriptions

- Auth: `requireMobileAuth`
- Body fields: `lat`, `lon`, `countryCode?`, `label`, `alertTier?`
- Controller: `ParasiteRiskController.createSubscription`
- Response: `201`: JSON

### DELETE /subscriptions/:subscriptionId

- Auth: `requireMobileAuth`
- Params: `subscriptionId`
- Controller: `ParasiteRiskController.deleteSubscription`
- Response: `204`: no content
