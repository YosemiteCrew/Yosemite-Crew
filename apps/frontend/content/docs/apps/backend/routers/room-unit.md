---
id: backend-api-room-unit
title: Room Unit API
slug: /apps/backend/api/room-unit
---

API routes for the room unit feature.

**Endpoints**

### POST /

- Auth: `requireWebAuth`
- Permission: `room:edit:any`
- Controller: `RoomUnitController`

### GET /

- Auth: `requireWebAuth`
- Permission: `room:view:any`
- Controller: `RoomUnitController`

### PUT /:id

- Auth: `requireWebAuth`
- Permission: `room:edit:any`
- Controller: `RoomUnitController`

### DELETE /:id

- Auth: `requireWebAuth`
- Permission: `room:edit:any`
- Controller: `RoomUnitController`
