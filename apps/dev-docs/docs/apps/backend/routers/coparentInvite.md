---
id: backend-api-coparentInvite
title: Coparentinvite API
slug: /apps/backend/api/coparentInvite
---

Handles co-parent invitations, letting a pet parent invite another person to share access to a companion (pet). Called by the mobile app; the `/validate` route is public (no auth) so an invite token can be checked before the invitee signs in.

**Endpoints**

### POST /sent

- Auth: `authorizeCognitoMobile`
- Body: `JSON`
- Body fields: `email`, `companionId`, `inviteeName`
- Controller: `CoParentInviteController.sendInvite`
- Response: `401`: keys `message`, `400`: keys `message`, `201`: keys `message`, `500`: keys `message`

### POST /accept

- Auth: `authorizeCognitoMobile`
- Body: `JSON`
- Body fields: `token`
- Controller: `CoParentInviteController.acceptInvite`
- Response: `401`: keys `message`, `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### POST /validate

- Body: `JSON`
- Body fields: `token`
- Controller: `CoParentInviteController.declineInvite`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### GET /pending

- Auth: `authorizeCognitoMobile`
- Controller: `CoParentInviteController.getPendingInvites`
- Response: `400`: keys `message`, `404`: keys `message`, `200`: keys `message`, `500`: keys `message`
