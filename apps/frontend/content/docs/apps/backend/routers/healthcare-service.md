---
id: backend-api-healthcare-service
title: Healthcare Service API
slug: /apps/backend/api/healthcare-service
---

Exposes an organisation's product/service catalog (consultations, procedures, diagnostics, lab tests, packages, and so on) as the FHIR `HealthcareService` resource, backed by `CatalogController`/`CatalogService`. Routes with no `:organisationId` path segment resolve the organisation from the RBAC-authorized session context; `GET /`, `GET /:id`, and the two `$` operations additionally accept it via the FHIR `organization` or `provided-by` query parameter (mapped onto the RBAC check by an `attachOrganisationIdFromQuery` middleware before `withOrgPermissions` runs).

**Endpoints**

### POST /

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body: FHIR `HealthcareService` resource (only `resourceType: "HealthcareService"` is validated; the rest passes through)
- Controller: `CatalogController.createProduct`
- Response: `201`: FHIR `HealthcareService` resource (also sets an `ETag: W/"<version>"` header), `400`: keys `message`, `errors`

### PATCH /:id

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `id`
- Body: FHIR `HealthcareService` resource; an `If-Match: W/"<version>"` request header is parsed as the expected version for optimistic concurrency
- Controller: `CatalogController.updateProduct`
- Response: `200`: FHIR `HealthcareService` resource (`ETag` header set), `400`: keys `message`, `errors`

### GET /:id

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `id`
- Query: `organisationId`
- Controller: `CatalogController.getProductById`
- Response: `200`: FHIR `HealthcareService` resource (`ETag` header set)

### GET /

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Query: `specialityId`, `kinds`, `search`, `supportsInpatient`, `includeInactive`, `organization`, `provided-by`, `specialty`, `active`, `name`, `kind`, `code`
- Controller: `CatalogController.listProducts`
- Response: `200`: FHIR `Bundle` of `HealthcareService` resources, `400`: keys `message`, `errors`

### POST /\$resolve-selection

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body: FHIR `Parameters` resource with `productItemId` (required, `valueString`) and `organization` (optional, `valueString`, e.g. `Organization/<id>`)
- Controller: `CatalogController.resolveProductOperation`
- Response: `200`: FHIR `Parameters` describing the resolved catalog selection (`productItemId`, `name`, `productKind`, pricing amounts, `billingItems`, `includedItems`), `400`: keys `message`

### POST /\$search-components

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body: FHIR `Parameters` resource with `organization` (required, `valueString`), and optional `q`, `specialty`/`speciality`, `kinds` (comma-separated), `includeArchived` (`valueBoolean`), `excludePackageId`, `includeNestedBreakdown` (`valueBoolean`), `page`, `pageSize` (`valueInteger`)
- Controller: `CatalogController.searchCatalogOperation`
- Response: `200`: FHIR `Parameters` with `query`, `page`, `pageSize`, `total`, and an `items` part listing the matched catalog items, `400`: keys `message`
