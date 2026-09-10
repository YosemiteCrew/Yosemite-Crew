---
id: backend-api-developer-billing
title: Developer Billing API
slug: /apps/backend/api/developer-billing
---

Lets a signed-in developer view and manage their own subscription from the developer portal (`/developers/billing` in the frontend) — the current plan and Stripe subscription status, a Stripe Checkout link to subscribe, and a Stripe customer-portal link to manage payment details or cancel. Like the API key routes, this is session-authenticated only: every call is scoped to the caller's own verified id, with no organisation or role gate. The Stripe webhook that reconciles subscription state is deliberately not part of this router — it is registered directly on the app, outside the JSON body parser, because Stripe's signature check needs the raw request body.

**Endpoints**

### GET /

- Auth: `requireWebAuth`, `requireActiveAccount()`
- Controller: `DeveloperBillingController.getSubscription`
- Response: `200`: keys `data` — `plan`, `status`, `currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`, and related Stripe ids; a `free`/`active` placeholder when no subscription row exists yet

### POST /checkout

- Auth: `requireWebAuth`, `requireActiveAccount()`
- Body fields: `successUrl`, `cancelUrl`
- Controller: `DeveloperBillingController.createCheckout`
- Response: `201`: keys `data` — `data.url` is the Stripe Checkout session URL to redirect the browser to

### POST /portal

- Auth: `requireWebAuth`, `requireActiveAccount()`
- Body fields: `returnUrl`
- Controller: `DeveloperBillingController.createPortal`
- Response: `201`: keys `data` — `data.url` is the Stripe customer-portal session URL
