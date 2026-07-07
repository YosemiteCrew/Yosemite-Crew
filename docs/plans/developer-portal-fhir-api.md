# Developer Portal - FHIR R4 Read API

## Document Status

- Owner: Developer portal workstream (epic #1582)
- Scope: `apps/backend` (a `/fhir` subtree of the developer data plane), `packages/types` (converter hardening + Prisma-to-domain adapters), `apps/dev-docs` (capability statement and resource docs)
- Depends on: the [Developer Data API contract](./developer-portal-data-api.md) and its mounting PR (auth, scopes, rate limits, quota are all reused unchanged); PR #1696 (key issuance, unmerged as of 2026-07-07)
- Related: [ADR 0004](../adr/0004-developer-tenant-data-residency.md), [webhooks plan](./developer-portal-webhooks.md), [delegated OAuth plan](./developer-portal-delegated-oauth.md)
- Status: Proposed - design for ratification

---

## 1. Goal

Give integrators who already speak FHIR - insurers, reference labs, referral networks, HIE-style middleware - a read-only FHIR R4 surface over the same org-scoped data the JSON data API exposes, authenticated by the same API keys. The pitch: "if your system consumes FHIR Bundles, you do not need to write a Yosemite-specific client."

### Non-goals

- **No FHIR writes** in v1 - same read-only posture as the data API, and the v1.1 write gates (webhooks, audit, idempotency) apply here identically before any FHIR `create`/`update` is even discussed.
- **No bulk export (`$export`)** - Flat FHIR / bulk data is a separate capability with its own async job semantics; out of scope.
- **No SMART on FHIR** in v1 - user-delegated launch contexts belong to the [delegated OAuth plan](./developer-portal-delegated-oauth.md); aligning its scopes with SMART's `user/Patient.read` style is Phase C (section 7).
- **Not a general FHIR server.** Only the profiled resources in section 6, with the search parameters in section 5. Conformance is declared honestly in the capability statement, not aspirationally.

## 2. What actually exists today (investigated 2026-07-07)

The monorepo already carries substantial FHIR machinery, in three distinct layers plus one false friend:

1. **`packages/fhir` (`@yosemite-crew/fhir`)** - generated TypeScript types for all of FHIR R4, produced by `scripts/generate.ts` from the HL7 definitions archive (`definitions/r4/definitions.json.zip`). Exports every R4 resource interface including `Bundle`, `CapabilityStatement`, and `OperationOutcome`. Types only; no runtime code. This is the type foundation the new surface builds on.
2. **`packages/fhirtypes` (`@yosemite-crew/fhirtypes`)** - an older, hand-written set of FHIR type files (`Appointment.ts`, `Bundle.ts`, `CapabilityStatement.ts`, ...). A repo-wide grep finds **zero imports** of `@yosemite-crew/fhirtypes` in any app or package: it is dormant, superseded by `packages/fhir`. This plan does not build on it; retiring it is flagged as follow-up hygiene, not done here.
3. **Real converters in `packages/types`**, importing R4 types from `@yosemite-crew/fhir`:

   | Domain model    | Converter (file in `packages/types/src`)                                          | FHIR resource                         |
   | --------------- | --------------------------------------------------------------------------------- | ------------------------------------- |
   | Appointment     | `toFHIRAppointment` / `fromFHIRAppointment` (`appointment.ts`)                    | Appointment                           |
   | Companion (pet) | `toFHIRCompanion` / `fromFHIRCompanion` (`companion.ts`)                          | Patient                               |
   | Encounter       | `toFHIREncounter` / `fromFHIREncounter` (`encounter.ts`)                          | Encounter                             |
   | Invoice         | `toFHIRInvoice` / `fromFHIRInvoice` (`invoice.ts`)                                | Invoice                               |
   | Organisation    | `toFHIROrganisation` / `fromFHIROrganisation` (`organization.ts`)                 | Organization                          |
   | Case            | `toFHIRCase` (`case.ts`)                                                          | EpisodeOfCare                         |
   | Service/catalog | `toFHIRHealthcareService`, `toFHIRCatalogBundle` (`catalog.ts`)                   | HealthcareService                     |
   | Forms/templates | `toFHIRQuestionnaire`, `toFHIRQuestionnaireResponse` (`form.ts`, `template.ts`)   | Questionnaire / QuestionnaireResponse |
   | Speciality      | `toFHIRSpeciality` (`speciality.ts`, an Organization with `partOf`)               | Organization                          |
   | Parent          | `toFHIRRelatedPerson` (`parent.ts`)                                               | RelatedPerson                         |
   | Rooms/units     | `toFHIROrganisationRoom`, `toFHIRRoomUnit` (`organisationRoom.ts`, `roomUnit.ts`) | Location                              |

   `searchset` Bundle assembly already exists in at least five places (`speciality.ts`, `catalog.ts`, `task.ts`, `template.ts`, `clinical-artifact.ts`, plus `case-encounter.controller.ts`), and the converters are exercised in production: the mobile appointment flow round-trips FHIR Appointment payloads (`apps/mobileAppYC/src/features/appointments/services/appointmentsService.ts` uses `fromFHIRAppointment`).

4. **The false friend: the existing `/fhir/v1/*` mounts are not an integrator FHIR API.** `apps/backend/src/routers/index.ts` mounts roughly twenty routers under `/fhir/v1` (organization, companion, appointment, encounter, invoice, form, template, task, ...), but they are the internal application surface: browser/mobile session auth (`authorizeCognito` / `authorizeCognitoMobile`) plus RBAC middleware, and mixed payload conventions. `/fhir/v1/organization` mounts `organization.router.ts`, whose controller accepts either plain JSON or a FHIR-shaped body by sniffing `payload.resourceType === "Organization"` on input - many routes under the prefix serve plain JSON responses, there is no capability statement, and there are no FHIR search semantics. The prefix is historical naming. This plan leaves those routes untouched and builds the external surface on the data plane instead.

### Conformance gaps that must be fixed before external exposure

- `toFHIRCompanion` emits a `Patient.animal` element (`PatientWithAnimal = Patient & { animal?: PatientAnimal }` in `companion.ts`). `Patient.animal` was removed in R4; conformant output must carry the standard `patient-animal` extension instead. Internal callers tolerate the current shape; external validators will not.
- Identifier and code systems use placeholder URIs (`companion.ts` declares example-host microchip/passport identifier systems). External integrators will hard-code whatever we ship, so these must move to platform-owned canonical URIs first.
- The converters take `packages/types` domain shapes, not Prisma rows. The backend needs a thin Prisma-to-domain adapter per resource (pieces exist in services today) plus conformance tests that validate converter output against the R4 schema - neither exists as a tested unit now.

## 3. Endpoint shape: a FHIR dialect of the data plane

Three route forms, mounted inside the existing data plane so every guarantee of the [data API contract](./developer-portal-data-api.md) is inherited rather than re-implemented:

| Route                                    | Interaction  | Auth                                                                                               |
| ---------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------- |
| `GET /v1/developer/fhir/metadata`        | capabilities | Valid API key, **no scope**, exempt from quota increment (same carve-out as `/v1/developer/usage`) |
| `GET /v1/developer/fhir/{Resource}`      | search-type  | `authorizeApiKey` + the resource's scope                                                           |
| `GET /v1/developer/fhir/{Resource}/{id}` | read         | `authorizeApiKey` + the resource's scope                                                           |

- Org scoping is absolute and identical to the JSON API: every query filters by the key's `organisationId`; a `read` on another org's resource returns the same `404`-equivalent as a missing id (here: `OperationOutcome` with `not-found`).
- Scope map: `Patient` -> `patients:read`, `Appointment` -> `appointments:read`, `Encounter` -> `encounters:read`, `Invoice` -> `invoices:read`, `Organization` -> `organization:read`. No new scopes are introduced; a key that works on the JSON API works identically here.
- Per-key rate limits, monthly quota, `Retry-After`, and the `X-RateLimit-*` headers apply unchanged. A FHIR call and a JSON call are the same unit of metered usage.
- `Accept: application/fhir+json` is honored and is also the default response `Content-Type`; XML is not supported.

## 4. Envelope: FHIR Bundle, deviating from the JSON envelope - justified

The data API's `{ data, pagination }` envelope and `{ message, code }` error shape are deliberately **not** used on this subtree. FHIR clients (HAPI, insurer middleware, interface engines) parse `Bundle` and `OperationOutcome` natively; wrapping a Bundle inside a proprietary envelope would break every off-the-shelf consumer, which defeats the only reason this surface exists. The deviation is contained to `/v1/developer/fhir/*`; the JSON API remains the primary surface, and where a resource exists on both, they must serve the same underlying rows.

- **Search responses:** `Bundle` of `type: "searchset"`, entries carrying `search.mode: "match"`. No `total` (parity with the JSON API, which dropped `total` because org-wide counts cost a full extra query per page).
- **Pagination:** `Bundle.link` with `relation: "self"` and `relation: "next"`; the `next` URL carries the same opaque cursor as the JSON API in a `_cursor` query param, with `_count` (1-100, default 50) as the FHIR-conventional page-size param. Clients follow links; they must not parse the cursor.
- **Errors:** `OperationOutcome` with the HTTP statuses of the data API contract, and `issue[0].code` mapped from its error codes: `invalid_request` -> `invalid`, `missing_api_key`/`invalid_api_key` -> `security`, `insufficient_scope` -> `forbidden`, `not_found` -> `not-found`, `rate_limited`/`quota_exceeded` -> `throttled`, `internal_error` -> `exception`. The original machine code is preserved in `issue[0].details.coding[0].code` so a caller can branch on the same values in both dialects.

## 5. Search parameters (v1)

Small, honest, and mapped one-to-one onto the filters the JSON API already defines - no new query capability is invented for FHIR:

| Resource     | Parameters                                                                            | Maps to                                    |
| ------------ | ------------------------------------------------------------------------------------- | ------------------------------------------ |
| Appointment  | `date` (with `ge`/`le` prefixes), `status`, `_count`, `_cursor`                       | `dateFrom`/`dateTo`, `status`              |
| Patient      | `active`, `_count`, `_cursor`                                                         | `status` (ACTIVE join, `RecordStatus`)     |
| Encounter    | `status`, `patient` (reference), `date` (`ge`/`le`), `_count`, `_cursor`              | `status`, `patientId`, `periodStart` range |
| Invoice      | `status`, `patient` (reference), `date` (`ge`/`le`), `_count`, `_cursor`              | `status`, `patientId`, `createdAt` range   |
| Organization | none (singular: the key's own org; `GET /Organization` returns a one-entry searchset) | -                                          |

Status values: v1 accepts the platform enums documented in the data API (e.g. `CHECKED_IN`, `NO_SHOW`) as token values, because they are richer than the FHIR value sets and `toFHIRAppointment` already owns the outbound mapping. Accepting native FHIR status tokens as aliases is part of Phase B hardening. Unsupported search parameters are rejected with an `OperationOutcome` (`not-supported`), never silently ignored - silent ignoring is how integrators end up trusting unfiltered data.

## 6. v1 resource set - existing converters only

**In v1 (converter exists today, named in section 2):** `Organization`, `Patient`, `Appointment`, `Encounter`, `Invoice`. These are exactly the FHIR projections of the data API's five scoped resources, so scope semantics, field-level exclusions (no Stripe internals, no org credentials), and the `404`-for-foreign-org rule carry over mechanically.

**Deferred, converter exists but deliberately not in v1:**

| Resource                              | Converter                       | Why deferred                                                                   |
| ------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| EpisodeOfCare                         | `toFHIRCase`                    | Cases are not on the data API surface yet; add both dialects together          |
| HealthcareService                     | `toFHIRCatalogBundle`           | Catalog exposure needs its own scope decision                                  |
| Questionnaire / QuestionnaireResponse | `toFHIRQuestionnaire(Response)` | Clinical form content: needs a dedicated scope and a privacy review            |
| RelatedPerson                         | `toFHIRRelatedPerson`           | Pet-parent PII; insurers asking for it must trigger a data-minimisation review |
| Location                              | `toFHIRRoomUnit` et al.         | Low integrator demand; rooms are operational, not interop, data                |

Anything without a converter (Observation, DiagnosticReport, MedicationRequest, ...) is not promised anywhere in v1 docs. Labs will eventually want DiagnosticReport; that is new mapping work against the lab-order models and gets its own plan.

## 7. Capability statement and phasing

`GET /v1/developer/fhir/metadata` returns a `CapabilityStatement` (`kind: "instance"`, `fhirVersion: "4.0.1"`, `format: ["application/fhir+json"]`) listing exactly the section 6 resources with `read` + `search-type` and the section 5 parameters. It is generated from the same route metadata that mounts the endpoints, so it cannot drift - the data API's spec-in-lockstep rule (its section 7) applies to the capability statement the same way it applies to `openapi.yaml`.

Phasing:

1. **Prerequisite:** the data API mounting PR lands (`authorizeApiKey` live, scopes canonical, rate limiting in place).
2. **Phase A:** conformance fixes from section 2 (patient-animal extension, canonical identifier systems, Prisma-to-domain adapters, converter conformance tests), then `metadata` + `Patient` + `Organization`.
3. **Phase B:** `Appointment`, `Encounter`, `Invoice` with the section 5 search parameters; FHIR-native status token aliases; dev-docs pages per resource.
4. **Phase C (separate ratification):** deferred resources, `_lastUpdated`/incremental sync, SMART-style scope alignment with the [delegated OAuth plan](./developer-portal-delegated-oauth.md).

## 8. Open questions for the reviewer

1. Do we publish a formal implementation guide / StructureDefinition profiles for the animal-patient shape, or is documenting the extensions in dev-docs enough for the first integrators?
2. Insurers reconciling claims may need `Invoice.lineItem` detail beyond what `toFHIRInvoice` emits today - extend the converter in Phase B or wait for a named integrator requirement?
3. Incremental sync: is `_lastUpdated` search worth building, or do we point FHIR consumers at the [webhooks plan](./developer-portal-webhooks.md) for change signals and keep the FHIR surface stateless?
4. Should `packages/fhirtypes` be formally deprecated (README notice + removal from the workspace) as part of Phase A, given it has zero consumers and duplicates `packages/fhir`?
