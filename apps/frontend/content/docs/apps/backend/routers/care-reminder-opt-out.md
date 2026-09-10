---
id: backend-api-care-reminder-opt-out
title: Care Reminder Opt-Out API
slug: /apps/backend/api/care-reminder-opt-out
---

Public, unauthenticated unsubscribe flow for care-reminder emails. The recipient follows a link from an email client carrying an encrypted, single-use token that is the only credential and authorises exactly one action for one address at one practice. `GET` only validates the token and renders a confirmation page; `POST` performs the actual opt-out. This split is deliberate: mail providers and link-scanning security products fetch every URL in a delivered message before a human sees it, so a mutating `GET` would let mere delivery unsubscribe someone (the same reasoning behind RFC 8058 one-click unsubscribe being specified as `POST`).

**Endpoints**

### GET /unsubscribe

- Query: `token`
- Controller: `CareReminderOptOutController.confirm`
- Response: `200`: HTML confirmation page, `400`: `{ message }` for an invalid/expired token, `500`: `{ message }`

### POST /unsubscribe

- Body fields: `token` (read from the form body when posted from the confirmation page, otherwise falls back to the `token` query string)
- Controller: `CareReminderOptOutController.unsubscribe`
- Response: `200`: HTML success page for an HTML-accepting client, otherwise `{ message }`; `400`: `{ message }` for an invalid/expired token; `500`: `{ message }`
