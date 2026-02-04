---
id: backend-api-availability
title: Availability API
slug: /apps/backend/api/availability
---

**Endpoints**

### POST /:orgId/base
- Params: `orgId`
- Controller: `AvailabilityController.setAllBaseAvailability`

### GET /:orgId/base
- Params: `orgId`
- Controller: `AvailabilityController.getBaseAvailability`

### DELETE /:orgId/base
- Params: `orgId`
- Controller: `AvailabilityController.deleteBaseAvailability`

### POST /:orgId/:userId/base
- Params: `orgId`, `userId`
- Controller: `AvailabilityController.setBaseAvailabilityForUser`

### POST /:orgId/weekly
- Params: `orgId`
- Controller: `AvailabilityController.addWeeklyAvailabilityOverride`

### GET /:orgId/weekly
- Params: `orgId`
- Controller: `AvailabilityController.getWeeklyAvailabilityOverride`

### DELETE /:orgId/weekly
- Params: `orgId`
- Controller: `AvailabilityController.deleteWeeklyAvailabilityOverride`

### POST /:orgId/occupancy
- Params: `orgId`
- Controller: `AvailabilityController.addOccupancy`

### POST /:orgId/occupancy/bulk
- Params: `orgId`
- Controller: `AvailabilityController.addAllOccupancies`

### GET /:orgId/occupancy
- Params: `orgId`
- Controller: `AvailabilityController.getOccupancy`

### GET /:orgId/final
- Params: `orgId`
- Controller: `AvailabilityController.getFinalAvailability`

### GET /:orgId/status
- Params: `orgId`
- Controller: `AvailabilityController.getCurrentStatus`
