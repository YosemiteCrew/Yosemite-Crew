---
id: backend-api-dashboard
title: Dashboard API
slug: /apps/backend/api/dashboard
---

**Endpoints**

### GET /summary/:organisationId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `range`
- Controller: `DashboardController.summary`
- Response: `500`: keys `message`

### GET /appointments/:organisationId/trend
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `months`
- Controller: `DashboardController.appointmentsTrend`
- Response: `500`: keys `message`

### GET /revenue/:organisationId/trend
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `months`
- Controller: `DashboardController.revenueTrend`
- Response: `500`: keys `message`

### GET /appointment-leaders/:organisationId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `limit`, `range`
- Controller: `DashboardController.appointmentLeaders`
- Response: `500`: keys `message`

### GET /revenue-leaders/:organisationId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `limit`, `range`
- Controller: `DashboardController.revenueLeaders`
- Response: `500`: keys `message`

### GET /inventory/:organisationId/turnover
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `targetTurns`, `year`
- Controller: `DashboardController.inventoryTurnover`
- Response: `500`: keys `message`

### GET /inventory/:organisationId/products
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `limit`, `year`
- Controller: `DashboardController.productTurnover`
- Response: `500`: keys `message`
