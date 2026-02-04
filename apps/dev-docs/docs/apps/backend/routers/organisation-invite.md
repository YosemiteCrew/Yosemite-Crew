---
id: backend-api-organisation-invite
title: Organisation Invite API
slug: /apps/backend/api/organisation-invite
---

**Endpoints**

### POST /:token/accept
- Auth: `authorizeCognito`
- Params: `token`
- Controller: `OrganisationInviteController.acceptInvite`
- Response: `400`: keys `message`, `401`: keys `message`, `200`: keys `message`, `500`: keys `message`

### POST /:token/decline
- Auth: `authorizeCognito`
- Params: `token`
- Controller: `OrganisationInviteController.rejectInvite`
- Response: `400`: keys `message`, `401`: keys `message`, `200`: keys `message`, `500`: keys `message`

### GET /me/pending
- Auth: `authorizeCognito`
- Controller: `OrganisationInviteController.listMyPendingInvites`
- Response: `401`: keys `message`, `200`: keys `message`, `500`: keys `message`
