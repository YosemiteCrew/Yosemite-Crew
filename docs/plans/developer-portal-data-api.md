# Developer Data API - v1 Contract

**Goal:** Define the API-key-authenticated, org-scoped REST surface that developer API keys unlock (epic #1582, Phase 1). This is the data plane that the MCP server, the future `create-yosemite-app` SDK, and third-party integrators (issue #1404) will target.
**Scope:** `apps/backend` (new router + controllers), `apps/dev-docs` (OpenAPI spec).
**Status:** Proposed. Depends on PR #1696 (key issuance, `authorizeApiKey`, usage metering) which is built but not yet merged as of 2026-07-07; the middleware is currently mounted nowhere.
**Reference:** Closed PR #1726 prototyped 4 of these endpoints (`developer-data.router.ts`, `developer-data.controller.ts`); this contract supersedes it.
**Related:** [ADR 0004](../adr/0004-developer-tenant-data-residency.md) (tenant data residency), [ADR 0005](../adr/0005-ai-editing-agent-security-model.md) (the Phase 2 AI agent consumes this surface), [website builder plan](./developer-portal-website-builder.md) (Phase 3b), [Tier 2 GitHub App plan](./developer-portal-tier2-github-app.md).

---

## 1. Mount point and versioning

Two planes, deliberately separate:

| Plane            | Mount                | Auth                       | Purpose                                                                                                                                                                       |
| ---------------- | -------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Management plane | `/v1/developers/...` | Browser session (existing) | Issue/revoke keys, billing, subscription. Already mounted: `/v1/developers/api-keys`, `/v1/developers/billing`, `/v1/developers/usage` (`apps/backend/src/routers/index.ts`). |
| Data plane       | `/v1/developer/...`  | API key only               | The surface defined in this document.                                                                                                                                         |

- The singular `developer` vs plural `developers` distinction is intentional and must stay: management routes are what a human does in the portal with a session; data routes are what a key holder's server or agent does programmatically. A session token is never accepted on the data plane and an API key is never accepted on the management plane.
- `v1` is a path segment. Additive changes (new fields, new endpoints, new optional query params) ship without a version bump. Breaking changes (removed/renamed fields, changed semantics) require `/v2/developer/...` with a deprecation window for v1.
- Implementation: a single `developerDataRouter` mounted at `/v1/developer` in `apps/backend/src/routers/index.ts`, with `authorizeApiKey` applied router-wide (as PR #1726 did with `developerDataRouter.use(authorizeApiKey)`).

## 2. Authentication and org scoping

Authentication is exactly what `apps/backend/src/middlewares/api-key-auth.ts` already implements:

- `Authorization: Bearer yc_live_...` or `X-API-Key: yc_live_...`. `Authorization` wins when both are present.
- Keys are verified by SHA-256 hash lookup (`DeveloperApiKeyService.verify`). Unknown, revoked, or expired keys all return the same `401` - the API does not distinguish these cases to callers.
- On success the middleware sets `req.apiKey` (`{ id, organisationId, scopes, environment }`) and `req.organisationId`, so the request is bound to the key's organisation exactly like a session-authenticated org request.

**Org scoping is absolute.** Every query on the data plane is filtered by `organisationId` from the verified key. There is no query param, header, or path segment that selects an organisation; a key can only ever see its own org's data. Cross-org access does not exist in v1. (The schema-per-tenant machinery in `packages/database/src/tenant.ts` is orthogonal and unwired; v1 scoping is row-level `organisationId` filtering in the shared schema.)

### Environments

Keys carry `environment: live | test` (`DeveloperApiKeyEnvironment`), visible in the key prefix (`yc_live_`, `yc_test_`).

- **live** keys: full v1 surface against the organisation's production data.
- **test** keys: accepted on the same endpoints and same org data, read scopes only, and their calls are flagged so they are excluded from Stripe metered billing (they still count toward the free-tier abuse cap). This requires a small extension to `DeveloperUsageService.incrementAndCheck` in the mounting PR: accept the key environment and skip `reportToStripe` for test traffic.
- Full sandbox isolation (test keys hitting seeded sandbox data instead of production data) is deliberately deferred to the Phase 2 preview environment. Until then, docs must state plainly that test keys read real org data.

## 3. v1 resource surface (read-only)

Six resources, all GET. Field lists below are the contract; they are drawn from the actual Prisma models (`packages/database/prisma/schema.prisma`) and the PR #1726 controller selects. No field appears here that does not exist in the schema.

### 3.1 Appointments - scope `appointments:read`

Model: `Appointment` (org-owned, `@@index([organisationId, appointmentDate])`).

- `GET /v1/developer/appointments`
  - Query: `limit` (1-100, default 50), `cursor`, `status` (`REQUESTED | UPCOMING | CHECKED_IN | IN_PROGRESS | COMPLETED | CANCELLED | NO_SHOW`), `dateFrom` / `dateTo` (ISO 8601 with offset, filter on `appointmentDate`).
  - Sort: `appointmentDate` descending (fixed in v1).
  - Item fields: `id`, `organisationId`, `patient` (JSON snapshot), `lead`, `appointmentType`, `room`, `appointmentDate`, `startTime`, `endTime`, `timeSlot`, `durationMinutes`, `status`, `isEmergency`, `concern`, `createdAt`, `updatedAt`.
- `GET /v1/developer/appointments/:id`
  - List fields plus `supportStaff`, `attachments`, `formIds`, `caseId`, `encounterId`, `appointmentKind`.
  - `404` if the id does not exist **or belongs to another org** (same response for both - no existence leak).

### 3.2 Patients - scope `patients:read`

Model: `Patient`, reached through the `PatientOrganisation` join with `status: "ACTIVE"` (patients are shared across orgs; the join is the org-scoping boundary, as in the #1726 prototype). Path stays `/patients` to match the model name; "companions" is product language, not API language.

- `GET /v1/developer/patients`
  - Query: `limit`, `cursor`, `status` (`active | archived | inactive`, the `RecordStatus` enum).
  - Item fields: `id`, `name`, `type`, `breed`, `dateOfBirth`, `gender`, `photoUrl`, `status`, `isInsured`, `microchipNumber`, `createdAt`, `updatedAt`.
  - Implementation note: the #1726 prototype filtered `status` in JS after fetching; v1 must push the filter into the Prisma `where` so pagination stays correct.
- `GET /v1/developer/patients/:id`
  - List fields plus `speciesCode`, `breedCode`, `currentWeight`, `colour`, `allergy`, `isNeutered`, `passportNumber`.
  - `404` when there is no ACTIVE `PatientOrganisation` link for this org.

### 3.3 Encounters - scope `encounters:read`

Model: `Encounter` (org-owned, `@@index([organisationId, status])`).

- `GET /v1/developer/encounters`
  - Query: `limit`, `cursor`, `status`, `patientId`, `caseId`, `dateFrom` / `dateTo` (filter on `periodStart`).
  - Sort: `createdAt` descending.
  - Item fields: `id`, `caseId`, `organisationId`, `patientId`, `parentId`, `status`, `encounterClass`, `appointmentKind`, `title`, `reason`, `periodStart`, `periodEnd`, `createdAt`, `updatedAt`.
- `GET /v1/developer/encounters/:id` - same fields.

### 3.4 Invoices - scope `invoices:read`

Model: `Invoice` (org-owned via nullable `organisationId`; the org filter is `organisationId: <key org>`, which naturally excludes rows with null org).

- `GET /v1/developer/invoices`
  - Query: `limit`, `cursor`, `status` (`PENDING | AWAITING_PAYMENT | PAID | FAILED | CANCELLED | REFUNDED`), `patientId`, `appointmentId`, `dateFrom` / `dateTo` (filter on `createdAt`).
  - Sort: `createdAt` descending.
  - Item fields: `id`, `organisationId`, `patientId`, `parentId`, `appointmentId`, `subtotal`, `discountTotal`, `taxTotal`, `totalAmount`, `currency`, `status`, `visitBillingStage`, `paidAt`, `finalizedAt`, `createdAt`, `updatedAt`.
- `GET /v1/developer/invoices/:id`
  - List fields plus `items` (JSON line items), `invoiceDiscountType`, `invoiceDiscountValue`, `invoiceDiscountTotal`, `taxPercent`, `depositTargetAmount`, `depositCollectedAmount`, `paymentCollectionMethod`, `billingCollectionMode`.
  - Never exposed: `metadata`, Stripe/PSP internals on related `Payment` / `PaymentAttempt` rows.

### 3.5 Organization profile - scope `organization:read`

Model: `Organization` + `OrganizationAddress`. Singular resource - the key's own org, no id in the path.

- `GET /v1/developer/organization`
  - Fields: `id`, `name`, `type`, `email`, `phoneNo`, `website`, `imageUrl`, `isVerified`, `isActive`, `petNamePreference`, `averageRating`, `ratingCount`, `createdAt`, `updatedAt`, and `address` (`addressLine`, `city`, `state`, `postalCode`, `country`, `latitude`, `longitude`).
  - Never exposed: `documensoApiKey`, `documensoTeamId`, `stripeAccountId`, `googlePlacesId`, `taxId`, `dunsNumber`, compliance certificate numbers. Credentials and operational identifiers stay server-side.

### 3.6 Usage and quota introspection - no scope required

Backed by `DeveloperUsageService.getUsage` (`apps/backend/src/services/developer-usage.service.ts`).

- `GET /v1/developer/usage`
  - Response: `{ "data": { "billingPeriod": "2026-07", "callCount": 412, "limit": 1000 } }` (`limit` is `null` on pro/enterprise).
  - Any valid key may call it (no scope check) - an integrator must always be able to see where they stand.
  - **Exempt from the quota increment and the 429.** `authorizeApiKey` currently increments before every request; the mounting PR must route this one endpoint through key verification without `incrementAndCheck`, otherwise an org that has exhausted its quota can never observe that fact.

## 4. Scope taxonomy

`requireScope` (`api-key-auth.ts`) already checks exact string membership with a `*` wildcard, and PR #1726 already used the `resource:action` form. Today issuance (`developer-api-key.service.ts`) accepts arbitrary non-empty strings; the frontend collects them as free text. v1 replaces free-form scopes with a canonical list validated at issuance - fine-grained from day one, rather than layering a coarse-to-fine mapping on top:

**Canonical v1 scopes:** `appointments:read`, `patients:read`, `encounters:read`, `invoices:read`, `organization:read`. (`*` remains valid but is not offered in the portal UI; it exists for internal tooling.)

**Reserved for v1.1:** `appointments:write`, `patients:write`, `invoices:write`.

**Reserved for the Phase 2 editing agent ([ADR 0005](../adr/0005-ai-editing-agent-security-model.md)):** `config:read`, `config:draft:write` - read and draft-only write access to config-engine entities (Forms, Templates, ObservationTool). These join the canonical list when the agent surface ships; they never grant publish rights.

For any coarse scopes already stored on existing keys (`read`, `write`, `admin`), `DeveloperApiKeyService.verify` expands them at verification time, so no data migration is needed:

| Stored scope | Expands to                                                  |
| ------------ | ----------------------------------------------------------- |
| `read`       | all `:read` scopes                                          |
| `write`      | all `:read` + all `:write` scopes (writes inert until v1.1) |
| `admin`      | `*`                                                         |

The issuance endpoint (`POST /v1/developers/api-keys`) gains validation against the canonical list; unknown scopes become a `400` instead of being stored verbatim.

## 5. Conventions

### 5.1 Pagination: cursor-based

Cursor, not offset. Justification: appointment and invoice tables grow monotonically and are written concurrently with reads, so offset pages drift (rows shift between requests); offset also degrades to `O(n)` scans on large orgs, while Prisma's `cursor` + `take` pagination on the indexed `(sortField, id)` pair stays cheap and stable.

- Request: `?limit=50&cursor=<opaque>`. The cursor is an opaque base64url token encoding the last row's sort key + id; clients must not parse it.
- List envelope (replaces the `{ data, total }` shape from #1726 - `total` is dropped because org-wide counts are an extra full query per page):

```json
{
  "data": [ ... ],
  "pagination": { "nextCursor": "eyJpZCI6...", "hasMore": true, "limit": 50 }
}
```

- Single-resource envelope stays `{ "data": { ... } }`.

### 5.2 Error envelope

`apps/backend` controllers overwhelmingly return `{ message: string }` (see `user-profile.controller.ts`, `task.controller.ts`), and `authorizeApiKey` / `requireScope` already emit that shape. The data plane keeps `message` and adds a stable machine-readable `code`:

```json
{ "message": "Invalid or expired API key", "code": "invalid_api_key" }
```

| Status | Code                                  | When                                                                     |
| ------ | ------------------------------------- | ------------------------------------------------------------------------ |
| 400    | `invalid_request`                     | Malformed query params (zod parse failure) or invalid cursor             |
| 401    | `missing_api_key` / `invalid_api_key` | No key presented / unknown, revoked, or expired key                      |
| 403    | `insufficient_scope`                  | Key lacks the required scope (also for test keys on future write routes) |
| 404    | `not_found`                           | Resource absent or owned by another org                                  |
| 429    | `rate_limited` / `quota_exceeded`     | See 5.3                                                                  |
| 500    | `internal_error`                      | Unhandled failure; details only in server logs                           |

The mounting PR updates the two middleware responses to include `code`; the `message` strings stay as they are.

### 5.3 Rate limiting and 429 semantics

Two independent layers:

1. **Monthly quota** (exists): `DeveloperUsageService.incrementAndCheck` - free tier hard-stops at 1,000 calls/month; pro is metered to Stripe (no hard stop); enterprise is contractual. Exceeding it returns `429` with `code: quota_exceeded` and `Retry-After` set to the seconds remaining in the UTC billing month.
2. **Per-key rate limit** (new in the mounting PR): sliding window per key id, protecting the API from bursts long before the monthly counter matters.

| Tier       | Sustained                                 | Burst |
| ---------- | ----------------------------------------- | ----- |
| free       | 5 req/s                                   | 20    |
| pro        | 20 req/s                                  | 100   |
| enterprise | 100 req/s (default, contractual override) | 500   |

Per-key `429`s return `code: rate_limited` with `Retry-After` in seconds (typically 1). Every data-plane response also carries `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers for the per-key window. Per-key rejections happen before `incrementAndCheck`, so rate-limited requests do not consume monthly quota.

### 5.4 Worked example

```
GET /v1/developer/appointments?limit=2&status=UPCOMING&dateFrom=2026-07-01T00:00:00%2B00:00
Authorization: Bearer yc_live_<secret>
```

```json
{
  "data": [
    {
      "id": "9c1e...",
      "organisationId": "4f2a...",
      "patient": { "id": "...", "name": "Biscuit" },
      "lead": { "id": "...", "name": "Dr. ..." },
      "appointmentType": { "id": "...", "name": "Consultation" },
      "room": null,
      "appointmentDate": "2026-07-09T00:00:00.000Z",
      "startTime": "2026-07-09T09:30:00.000Z",
      "endTime": "2026-07-09T10:00:00.000Z",
      "timeSlot": "09:30",
      "durationMinutes": 30,
      "status": "UPCOMING",
      "isEmergency": false,
      "concern": "Limping on front left leg",
      "createdAt": "2026-07-02T14:11:08.000Z",
      "updatedAt": "2026-07-02T14:11:08.000Z"
    },
    { "...": "second row" }
  ],
  "pagination": { "nextCursor": "eyJpZCI6IjljMWUuLi4ifQ", "hasMore": true, "limit": 2 }
}
```

Note that `patient`, `lead`, `appointmentType`, and `room` are JSON snapshot columns on `Appointment` (denormalised at booking time), not joined relations - their inner shape is whatever the booking flow wrote and is documented as `object` in OpenAPI, not field-by-field. Integrators needing the authoritative patient record should follow up with `GET /v1/developer/patients/:id`.

Failure examples:

```
HTTP/1.1 403 Forbidden
{ "message": "Insufficient scope for this API key", "code": "insufficient_scope" }

HTTP/1.1 429 Too Many Requests
Retry-After: 1
{ "message": "Rate limit exceeded for this API key.", "code": "rate_limited" }

HTTP/1.1 429 Too Many Requests
Retry-After: 2073600
{ "message": "Monthly API quota exceeded. Upgrade to Pro to continue.", "code": "quota_exceeded" }
```

## 6. Write endpoints: deferred to v1.1

v1 ships read-only. The write surface is named now so scopes and docs can reserve it, but none of it mounts until the prerequisites land:

| Deferred endpoint                            | Scope                | Notes                                                                                                      |
| -------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------- |
| `POST /v1/developer/appointments`            | `appointments:write` | `Appointment.idempotencyKey` + `@@unique([organisationId, idempotencyKey])` already exist for safe retries |
| `POST /v1/developer/appointments/:id/cancel` | `appointments:write` | Status transition, not a raw PATCH                                                                         |
| `PATCH /v1/developer/patients/:id`           | `patients:write`     | Limited field set (weight, microchip, insurance flags)                                                     |
| `POST /v1/developer/invoices/:id/finalize`   | `invoices:write`     | Interacts with Stripe flows; last to ship                                                                  |

Gates, all of them, before any write mounts:

1. **Webhooks** - integrators need change notifications to reconcile writes they did not originate; shipping writes without them guarantees polling storms.
2. **Audit coverage** - every API-key write must land in `AuditTrail` with the key id as actor, same as a human user action.
3. **Idempotency convention** - an `Idempotency-Key` request header, honored via the existing appointment unique constraint and equivalents for other resources.
4. **Scope enforcement at issuance** - the canonical-scope validation from section 4 must be live so `:write` scopes are explicit opt-ins.

## 7. OpenAPI

This contract will be reflected in `apps/dev-docs/static/openapi.yaml` and kept in lockstep: any PR that changes a data-plane route, param, or response shape must update the spec in the same PR. The spec is the generation source for SDK types (`create-yosemite-app`) and the MCP server's tool schemas, so drift there breaks downstream tooling silently.

## 8. Phasing and dependencies

1. **PR #1696 merges first** - it carries the `DeveloperApiKey` / `DeveloperApiUsage` models, `DeveloperApiKeyService`, `DeveloperUsageService`, `authorizeApiKey` + `requireScope`, and the portal UI. This contract does not modify any of that beyond the small extensions listed below.
2. **This contract lands as the PR that finally mounts `authorizeApiKey`** - a new `developer-data.router.ts` at `/v1/developer` (resurrecting the #1726 router/controller pattern under the shapes above), plus:
   - cursor pagination helpers and the response envelopes (5.1, 5.2),
   - per-key rate limiting (5.3),
   - canonical scope validation at issuance + coarse-scope expansion at verify (4),
   - test-key metering exclusion (2) and the usage-endpoint quota exemption (3.6),
   - `openapi.yaml` in `apps/dev-docs`.
3. **After this**: the MCP server (retargeted from the closed #1726 package to these routes, under the agent security rules in [ADR 0005](../adr/0005-ai-editing-agent-security-model.md)) and the SDK consume the surface unchanged; v1.1 writes follow once the section 6 gates exist.

Non-dependency: `packages/database/src/tenant.ts` (schema-per-tenant provisioning) is not required for any of this and stays unwired; v1 relies solely on `organisationId` row scoping. Tenant provisioning and its residency posture are covered separately by [ADR 0004](../adr/0004-developer-tenant-data-residency.md).
