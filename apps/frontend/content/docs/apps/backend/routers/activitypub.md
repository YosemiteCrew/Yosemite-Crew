---
id: backend-api-activitypub
title: Activitypub API
slug: /apps/backend/api/activitypub
---

API routes for the activitypub feature.

**Endpoints**

### GET /organizations/:orgId

- Auth: `public`
- Controller: `ActivityPubController`

### POST /organizations/:orgId/inbox

- Auth: `public`
- Controller: `ActivityPubController`

### GET /organizations/:orgId/outbox

- Auth: `public`
- Controller: `ActivityPubController`

### GET /organizations/:orgId/followers

- Auth: `public`
- Controller: `ActivityPubController`

### GET /organizations/:orgId/following

- Auth: `public`
- Controller: `ActivityPubController`

### POST /shared-inbox

- Auth: `public`
- Controller: `ActivityPubController`

### GET /manage/actor

- Auth: `requireWebAuth`
- Permission: `integrations:view:any`
- Controller: `ActivityPubController`

### PUT /manage/actor

- Auth: `requireWebAuth`
- Permission: `integrations:edit:any`
- Controller: `ActivityPubController`

### POST /manage/follow

- Auth: `requireWebAuth`
- Permission: `integrations:edit:any`
- Controller: `ActivityPubController`

### POST /manage/unfollow

- Auth: `requireWebAuth`
- Permission: `integrations:edit:any`
- Controller: `ActivityPubController`

### POST /manage/followers/approve

- Auth: `requireWebAuth`
- Permission: `integrations:edit:any`
- Controller: `ActivityPubController`

### POST /manage/followers/reject

- Auth: `requireWebAuth`
- Permission: `integrations:edit:any`
- Controller: `ActivityPubController`

### GET /manage/followers

- Auth: `requireWebAuth`
- Permission: `integrations:view:any`
- Controller: `ActivityPubController`

### GET /manage/following

- Auth: `requireWebAuth`
- Permission: `integrations:view:any`
- Controller: `ActivityPubController`

### POST /manage/referrals

- Auth: `requireWebAuth`
- Permission: `integrations:edit:any`
- Controller: `ActivityPubController`

### GET /manage/referrals/inbound

- Auth: `requireWebAuth`
- Permission: `integrations:view:any`
- Controller: `ActivityPubController`

### GET /manage/referrals/outbound

- Auth: `requireWebAuth`
- Permission: `integrations:view:any`
- Controller: `ActivityPubController`

### PUT /manage/license-token

- Auth: `requireWebAuth`
- Permission: `integrations:edit:any`
- Controller: `ActivityPubController`

### PUT /manage/directory-listing

- Auth: `requireWebAuth`
- Permission: `integrations:edit:any`
- Controller: `ActivityPubController`

### GET /manage/directory

- Auth: `requireWebAuth`
- Permission: `integrations:view:any`
- Controller: `ActivityPubController`

### PATCH /manage/referrals/:referralId

- Auth: `requireWebAuth`
- Permission: `integrations:edit:any`
- Controller: `ActivityPubController`

### POST /manage/notes

- Auth: `requireWebAuth`
- Permission: `integrations:edit:any`
- Controller: `ActivityPubController`

### POST /manage/announce

- Auth: `requireWebAuth`
- Permission: `integrations:edit:any`
- Controller: `ActivityPubController`
