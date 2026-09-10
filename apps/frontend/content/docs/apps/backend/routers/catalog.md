---
id: backend-api-catalog
title: Catalog API
slug: /apps/backend/api/catalog
---

Organisation-scoped catalog of billable products: services (consultation, procedure, diagnostic, lab test), packages (bundles of services with their own pricing/discount policy), and the specialities they're grouped under. Covers CRUD for specialities, services and packages (including archive/restore soft-delete), catalog search, nearby-organisation lookup, bookable-slot and calendar-prefill helpers used by booking flows, and resolving a selected catalog item back to its billing details. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and are gated by organisation RBAC (role-based access control). The router comment notes these are compatibility-only JSON routes — new catalog clients should prefer `/fhir/v1/healthcare-service` and its FHIR custom operations.

**Endpoints**

### POST /products

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body: FHIR `HealthcareService` resource (only `resourceType` is strictly validated; the rest is mapped via `fromCatalogRequestDTO`)
- Controller: `CatalogController.createProduct`
- Response: `201`: the created product as a FHIR-shaped `HealthcareService` (`toCatalogResponseDTO`); sets an `ETag` response header from the record version

### PATCH /products/:id

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `id`
- Body: FHIR `HealthcareService` resource; supports an `If-Match` request header for optimistic-concurrency version checks
- Controller: `CatalogController.updateProduct`
- Response: `200`: the updated product as a FHIR-shaped `HealthcareService`

### GET /products/:id

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `id`
- Query: `organisationId`
- Controller: `CatalogController.getProductById`
- Response: `200`: the product as a FHIR-shaped `HealthcareService`

### GET /packages/:id

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `id`
- Query: `organisationId`
- Controller: `CatalogController.getPackageDetail`

### GET /organisation/:organisationId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `specialityId`, `kinds`, `search`, `supportsInpatient`, `includeInactive`, `organization`, `provided-by`, `specialty`, `active`, `name`, `kind`, `code`
- Controller: `CatalogController.listProducts`
- Response: `200`: a FHIR `Bundle` of products (`toCatalogBundleResponseDTO`)

### GET /organisations/:organisationId/summary

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `search`, `includeArchived`
- Controller: `CatalogController.getOrganisationSummary`

### GET /organisations/:organisationId/services/nearby

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `lat`, `lng`, `radius` (defaults to 5000)
- Controller: `CatalogController.getCatalogNearbyOrganisations`

### POST /organisations/:organisationId/bookable-slots

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `catalogBookableSlotsSchema`
- Body fields: `productItemId` or `serviceId` (one required), `date` (`YYYY-MM-DD`)
- Controller: `CatalogController.getCatalogBookableSlots`
- Response: `200`: keys `success`, `data`; `400`: `{ message }` if neither `productItemId` nor `serviceId` is given

### POST /organisations/:organisationId/bookable-slots/calendar-prefill

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `catalogCalendarPrefillSchema`
- Body fields: `organisationId`, `date` (`YYYY-MM-DD`), `minuteOfDay`, `leadId`, `productItemIds` or `serviceIds` (at least one required)
- Controller: `CatalogController.getCatalogCalendarPrefill`
- Response: `200`: keys `success`, `data` (`data.matches`); `400`: `{ message }` if no service ids are given

### GET /organisations/:organisationId/specialities

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `search`, `status` (`ACTIVE` or `ARCHIVED`), `page`, `pageSize`
- Controller: `CatalogController.listSpecialities`

### POST /organisations/:organisationId/specialities

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `specialityMutationSchema`
- Body fields: `name` (required), `headUserId`, `headName`, `headProfilePicUrl`, `teamMemberIds`
- Controller: `CatalogController.createSpeciality`
- Response: `201`: the created speciality

### PATCH /organisations/:organisationId/specialities/:specialityId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `specialityId`
- Body: `specialityMutationSchema`
- Body fields: `name`, `headUserId`, `headName`, `headProfilePicUrl`, `teamMemberIds`
- Controller: `CatalogController.updateSpeciality`

### POST /organisations/:organisationId/specialities/:specialityId/archive

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `specialityId`
- Controller: `CatalogController.archiveSpeciality`

### POST /organisations/:organisationId/specialities/:specialityId/restore

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `specialityId`
- Controller: `CatalogController.restoreSpeciality`

### DELETE /organisations/:organisationId/specialities/:specialityId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `specialityId`
- Controller: `CatalogController.deleteSpeciality`
- Response: `204`: `{}`

### GET /organisation/:organisationId/specialities/:specialityId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `specialityId`
- Query: `tab` (`services`, `packages`, or `all`), `search`, `includeInactive`
- Controller: `CatalogController.getSpecialityCatalog`

### GET /organisations/:organisationId/specialities/:specialityId/services

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `specialityId`
- Query: `status` (`ACTIVE`, `ARCHIVED`, or `ALL`), `search`, `kind`, `isBookable`, `supportsInpatient`
- Controller: `CatalogController.listServicesBySpeciality`
- Response: `200`: keys `items`

### POST /organisations/:organisationId/specialities/:specialityId/services

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `specialityId`
- Body: `serviceMutationSchema`
- Body fields: `name` (required), `description`, `kind` (required; `CONSULTATION`, `PROCEDURE`, `DIAGNOSTIC`, or `LAB_TEST`), `isBookable`, `appointmentModes`, `durationMinutes`, `unitPrice`, `currency`, `defaultDiscountPercent`, `maxDiscountPercent`, `code`, `isActive`
- Controller: `CatalogController.createService`
- Response: `201`: the created service

### PATCH /organisations/:organisationId/services/:id

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `id`
- Body: `serviceMutationSchema`; supports an `If-Match` request header for optimistic-concurrency version checks
- Body fields: `name`, `description`, `kind`, `isBookable`, `appointmentModes`, `durationMinutes`, `unitPrice`, `currency`, `defaultDiscountPercent`, `maxDiscountPercent`, `code`, `isActive`
- Controller: `CatalogController.updateService`

### POST /organisations/:organisationId/services/:id/archive

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `id`
- Controller: `CatalogController.archiveService`

### POST /organisations/:organisationId/services/:id/restore

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `id`
- Controller: `CatalogController.restoreService`

### DELETE /organisations/:organisationId/services/:id

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `id`
- Controller: `CatalogController.deleteService`
- Response: `204`: `{}`

### GET /organisations/:organisationId/specialities/:specialityId/packages

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `specialityId`
- Query: `status` (`ACTIVE`, `ARCHIVED`, or `ALL`), `search`, `supportsInpatient`
- Controller: `CatalogController.listPackagesBySpeciality`
- Response: `200`: keys `items`

### POST /organisations/:organisationId/specialities/:specialityId/packages

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `specialityId`
- Body: `packageMutationSchema`
- Body fields: `name` (required), `description`, `isBookable`, `appointmentModes`, `durationMinutes`, `unitPrice`, `currency`, `defaultDiscountPercent`, `maxDiscountPercent`, `leadCount`, `supportCount`, `additionalDiscountPercent`, `code`, `isActive`, `breakdown` (array of `{ childItemId, quantity, pricingMode, overridePrice, discountPercent, isOptional, sortOrder }`)
- Controller: `CatalogController.createPackage`
- Response: `201`: the created package

### GET /organisations/:organisationId/packages/:id

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `id`
- Query: `organisationId` (read separately from the query string for authorization; the path segment itself is unused by this handler)
- Controller: `CatalogController.getPackageDetail`

### PATCH /organisations/:organisationId/packages/:id

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `id`
- Body: `packageMutationSchema`; supports an `If-Match` request header for optimistic-concurrency version checks
- Body fields: `name`, `description`, `isBookable`, `appointmentModes`, `durationMinutes`, `unitPrice`, `currency`, `defaultDiscountPercent`, `maxDiscountPercent`, `leadCount`, `supportCount`, `additionalDiscountPercent`, `code`, `isActive`, `breakdown`
- Controller: `CatalogController.updatePackage`

### POST /organisations/:organisationId/packages/:id/archive

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `id`
- Controller: `CatalogController.archivePackage`

### POST /organisations/:organisationId/packages/:id/restore

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `id`
- Controller: `CatalogController.restorePackage`

### DELETE /organisations/:organisationId/packages/:id

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `id`
- Controller: `CatalogController.deletePackage`
- Response: `204`: `{}`

### GET /organisations/:organisationId/items/search

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `q`, `specialityId`, `kinds`, `includeArchived`, `excludePackageId`, `includeNestedBreakdown`, `page`, `pageSize`
- Controller: `CatalogController.searchItems`

### GET /organisations/:organisationId/specialities/:specialityId/archive

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `specialityId`
- Query: `search`
- Controller: `CatalogController.getArchiveCatalog`

### POST /resolve

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body: `resolveSchema`
- Body fields: `productItemId`, `organisationId` (optional)
- Controller: `CatalogController.resolveProduct`
