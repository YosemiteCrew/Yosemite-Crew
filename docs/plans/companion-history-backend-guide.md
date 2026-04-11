# Companion History Backend Guide

## Objective

Replace the current appointment-only companion history with a production-grade, org-scoped medical history timeline that can be reused in:

1. Appointment modal: `Appointments -> View Appointment -> Info -> History`
2. Companion modal: `Companions -> View Companion -> History`
3. Full screen page: `Companions -> History` (opened from appointments/companions)

The new history must show a unified timeline of:

1. Past appointments
2. Companion tasks
3. SOAP / prescription / other form submissions
4. Documents
5. Labs / IDEXX results
6. Finance / invoice events
7. Audit trail (available as a dedicated History filter)

This work must be backward-compatible. Existing appointment, finance, invoice, SOAP, lab, and document flows must keep working unchanged.

## Current State Summary

### What already exists

1. Appointments:
   - Org-scoped appointment list exists via `/fhir/v1/appointment/pms/organisation/:organisationId`
   - Companion+org appointment list exists via `/fhir/v1/appointment/pms/organisation/:organisationId/companion/:companionId`
2. Tasks:
   - Companion task list exists via `/v1/task/pms/companion/:companionId`
3. Documents:
   - Companion document list exists via `/v1/document/pms/:companionId`
   - Companion document upload exists via `/v1/document/pms/:companionId` + `/v1/document/pms/upload-url`
4. Labs:
   - Lab results can be filtered by `companionId` via `/v1/labs/pms/organisation/:organisationId/:provider/results`
   - Lab orders can be filtered by `companionId` via `/v1/labs/pms/organisation/:organisationId/:provider/orders`
5. Finance:
   - Invoice service already supports `listForCompanion(companionId)`
6. Audit:
   - Audit trail exists but is not a sufficient replacement for medical history

### Main gap

There is no companion-wide PMS API that returns form submissions / SOAP entries across the companion's appointment history in an org-scoped way.

Current form APIs are appointment-scoped:

1. `/fhir/v1/form/appointments/:appointmentId/soap-notes`
2. `/fhir/v1/form/appointments/:appointmentId/forms`

That makes frontend-only aggregation incomplete and inefficient for a true history view.

## Recommended Backend Design

### New endpoint

Add a new PMS endpoint dedicated to companion history aggregation.

Suggested route:

```ts
GET /v1/companion-history/pms/organisation/:organisationId/companion/:companionId
```

Suggested query params:

```ts
type CompanionHistoryQuery = {
  limit?: number; // default 50, max 100
  cursor?: string; // opaque keyset cursor
  types?: string; // comma-separated filter
};
```

Supported `types` values:

1. `APPOINTMENT`
2. `TASK`
3. `FORM_SUBMISSION`
4. `DOCUMENT`
5. `LAB_RESULT`
6. `INVOICE`
7. `AUDIT_TRAIL` (optional future extension; currently fetched via existing audit endpoint)

### Response shape

Return a normalized timeline payload instead of raw domain objects.

```ts
type HistoryEntryType =
  | 'APPOINTMENT'
  | 'TASK'
  | 'FORM_SUBMISSION'
  | 'DOCUMENT'
  | 'LAB_RESULT'
  | 'INVOICE';

type HistoryEntryStatus =
  | 'REQUESTED'
  | 'UPCOMING'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'PENDING'
  | 'SIGNED'
  | 'FAILED'
  | 'PAID'
  | 'ACTIVE'
  | 'UNKNOWN';

type HistoryEntryActor = {
  id?: string;
  name?: string;
  role?: 'VET' | 'STAFF' | 'PARENT' | 'SYSTEM';
};

type HistoryEntryLink = {
  kind: 'appointment' | 'task' | 'form_submission' | 'document' | 'lab_result' | 'invoice';
  id: string;
  appointmentId?: string;
  companionId: string;
};

type HistoryEntry = {
  id: string;
  type: HistoryEntryType;
  occurredAt: string;
  status?: HistoryEntryStatus;
  title: string;
  subtitle?: string;
  summary?: string;
  actor?: HistoryEntryActor;
  tags?: string[];
  link: HistoryEntryLink;
  source: 'APPOINTMENT' | 'TASK' | 'FORM' | 'DOCUMENT' | 'LAB' | 'INVOICE';
  payload: Record<string, unknown>;
};

type CompanionHistoryResponse = {
  entries: HistoryEntry[];
  nextCursor: string | null;
  summary: {
    totalReturned: number;
    countsByType: Record<HistoryEntryType, number>;
  };
};
```

## Architecture

Follow the existing backend pattern:

```text
Router -> Controller -> Service -> Models / existing services
```

Suggested new files:

1. `apps/backend/src/routers/companion-history.router.ts`
2. `apps/backend/src/controllers/web/companion-history.controller.ts`
3. `apps/backend/src/services/companion-history.service.ts`

Register router in:

1. [index.ts](/Users/harshitwandhare/Desktop/Yosemite-Crew/apps/backend/src/routers/index.ts)

## Service Responsibilities

### `CompanionHistoryService.listForCompanion`

Input:

```ts
{
  organisationId: string;
  companionId: string;
  limit?: number;
  cursor?: string;
  types?: HistoryEntryType[];
}
```

Responsibilities:

1. Validate `organisationId`, `companionId`, `limit`, `cursor`
2. Load all requested source records
3. Normalize them into `HistoryEntry`
4. Sort by `occurredAt desc`
5. Apply cursor pagination
6. Return summary counts

## Source Adapters

Implement the history service as a set of internal source loaders / mappers.

### 1. Appointments

Use:

1. `AppointmentService.getAppointmentsForCompanionByOrganisation(companionId, organisationId)`

Map each appointment to one history entry.

Recommended fields:

1. `title`: service name or appointment type
2. `subtitle`: appointment date + room
3. `summary`: concern / reason
4. `actor`: lead vet
5. `payload`:
   - `appointmentId`
   - `serviceName`
   - `specialityName`
   - `reason`
   - `roomName`
   - `leadName`
   - `supportStaffNames`
   - `paymentStatus`

Use `startTime` as `occurredAt`.

### 2. Tasks

Use:

1. `TaskService.listForCompanion({ companionId })`

Filter in service to org-safe tasks:

1. Include only tasks with `organisationId === requested organisationId`
2. If org-less parent tasks exist and product wants strict org scope, exclude them

Recommended fields:

1. `title`: task name
2. `subtitle`: task category / audience
3. `summary`: description or medication summary
4. `actor`: assignee if resolvable
5. `payload`:
   - `taskId`
   - `appointmentId`
   - `audience`
   - `category`
   - `dueAt`
   - `completedAt`
   - `medication`

Use `completedAt ?? dueAt ?? createdAt` as `occurredAt`.

### 3. Form submissions / SOAP

This is the main new backend work.

#### New form service method

Add:

```ts
FormService.listSubmissionsForCompanionInOrganisation(params: {
  organisationId: string;
  companionId: string;
})
```

#### Retrieval strategy

For Postgres:

1. Query `formSubmission` where `companionId = companionId`
2. Join form metadata through `formId`
3. For appointment-bound submissions:
   - load appointments by `appointmentId`
   - keep only those whose `organisationId` matches
4. For submissions without `appointmentId`:
   - load form and keep only those whose `orgId` matches

For Mongo:

1. Query `FormSubmissionModel` by `companionId`
2. Resolve form documents
3. Resolve appointment documents for appointment-bound submissions
4. Apply same org filter logic

#### Output mapping

Recommended fields:

1. `title`: form name
2. `subtitle`: form category
3. `summary`: compact answer preview or "Submitted"
4. `status`:
   - `SIGNED` if signing status is signed
   - `COMPLETED` otherwise
5. `payload`:
   - `submissionId`
   - `formId`
   - `formVersion`
   - `formName`
   - `formCategory`
   - `appointmentId`
   - `signing`
   - `answers`

Use `submittedAt` as `occurredAt`.

#### SOAP categorization

If form category is one of:

1. `SOAP-Subjective`
2. `SOAP-Objective`
3. `SOAP-Assessment`
4. `SOAP-Plan`
5. `Discharge`

Set tags like:

1. `SOAP`
2. specific subtype

This lets frontend visually distinguish clinical notes from generic forms.

### 4. Documents

Use:

1. `DocumentService.listForPms({ companionId })`

Current constraint:

1. `Document` does not store `organisationId`
2. API visibility depends on `pmsVisible`, not true org ownership

For this phase:

1. Reuse current behavior
2. Include `pmsVisible` documents for the companion
3. Prefer documents with appointment-linked org match if `appointmentId` exists
4. Include org-unlinked docs as current-visibility records

Recommended fields:

1. `title`: document title
2. `subtitle`: category / subcategory
3. `summary`: issuing business + attachment summary
4. `payload`:
   - `documentId`
   - `appointmentId`
   - `category`
   - `subcategory`
   - `issueDate`
   - `issuingBusinessName`
   - `attachmentCount`
   - `openable`

Use `issueDate ?? createdAt` as `occurredAt`.

### 5. Lab results

Use:

1. `LabResultService.list({ organisationId, provider: "IDEXX", companionId })`
2. Optionally also `LabOrderService.listOrders({ organisationId, companionId, provider: "IDEXX" })`

Recommendation:

1. Return only result entries in timeline v1
2. Put order metadata inside `payload` when resolvable
3. Add order entries later only if UI truly needs both rows

Recommended fields:

1. `title`: patient/result label, e.g. `IDEXX Result`
2. `subtitle`: result status
3. `summary`: top abnormal values or result category count
4. `payload`:
   - `resultId`
   - `orderId`
   - `patientName`
   - `status`
   - `accessionId`
   - `pdfAvailable`

Use `updatedAt ?? createdAt` as `occurredAt`.

### 6. Invoices

Use:

1. `InvoiceService.listForCompanion(companionId)`

Filter:

1. Keep only `organisationId === requested organisationId`

Recommended fields:

1. `title`: `Invoice`
2. `subtitle`: invoice status
3. `summary`: amount + payment collection method
4. `payload`:
   - `invoiceId`
   - `appointmentId`
   - `status`
   - `totalAmount`
   - `currency`
   - `paymentCollectionMethod`
   - `paidAt`

Use `paidAt ?? createdAt` as `occurredAt`.

## Pagination

Use keyset pagination, not offset pagination.

Suggested cursor format:

```ts
type HistoryCursor = {
  occurredAt: string;
  id: string;
};
```

Encoding:

1. JSON string
2. base64 encode

Paging rule:

1. Sort by `occurredAt desc`, tie-break by `id desc`
2. Next page starts after the last returned item

## Controller

### Route behavior

Validate:

1. `organisationId`
2. `companionId`
3. `limit`
4. `types`

Return:

1. `200` with normalized response
2. `400` for invalid params
3. `404` only if companion does not exist or not visible in org context

## Permissions

Add RBAC guard similar to other PMS routes.

Suggested minimum:

1. `companions:view:any`

Inside service, type-specific inclusion should also respect permissions if you want cleaner defense:

1. If caller lacks `tasks:view:any`, omit tasks
2. If caller lacks `document:view:any`, omit documents
3. If caller lacks `labs:view:any`, omit labs
4. If caller lacks `forms:view:any` or `prescription:view:any`, omit form rows
5. If caller lacks finance visibility, omit invoices

If per-type permission plumbing is too large for this refactor, keep route-level gating and note type-level permission refinement as a follow-up.

## Backward Compatibility Rules

Do not break or remove:

1. Appointment finance tab and invoice APIs
2. Existing add document flow
3. Existing companion document GET / POST APIs
   - Frontend already depends on these APIs directly for `History -> Documents` filter and upload-refresh behavior
4. Existing appointment SOAP APIs
5. Existing IDEXX lab tabs and APIs

This new endpoint is additive.

## Frontend-Implemented Behavior (Current)

1. `History -> Documents` currently uses existing companion document APIs as source of truth:
   - GET: `/v1/document/pms/:companionId`
   - Upload: `/v1/document/pms/:companionId` (after signed upload URL flow)
2. Unified history endpoint remains the source for non-document filters (`All`, `Appointments`, `Tasks`, `SOAP/Templates`, `Labs`, `Finance`).
3. `History -> Audit trail` currently uses existing companion audit endpoint (`/v1/audit-trail/companion`), not companion-history API.
4. Therefore backend companion-history work should prioritize:
   - companion-wide form submission aggregation
   - consistent org-scoped normalization/pagination
   - optional audit integration only if we decide to consolidate endpoints later

## Data Quality Rules

### For appointment entries

Always prefer:

1. `appointment.appointmentType.name`
2. then fallback label like `Appointment`

### For task summaries

If medication task:

1. show medication name
2. dosage if present
3. frequency / time if present

### For forms

Do not send full answer payload if the frontend does not need it.
If payload size becomes large, trim payload to:

1. identifiers
2. signing state
3. small preview text

Recommendation:

1. include `answersPreview`
2. keep raw answers optional behind `includeRawAnswers=false`

For v1, sending raw answers is acceptable if payload stays manageable.

## Suggested Implementation Order

1. Create router, controller, service skeleton
2. Implement appointment adapter
3. Implement task adapter
4. Add new `FormService.listSubmissionsForCompanionInOrganisation`
5. Implement form submission adapter
6. Implement document adapter
7. Implement lab result adapter
8. Implement invoice adapter
9. Add merge-sort + cursor pagination
10. Add tests

## Testing Requirements

### Unit / service tests

Cover:

1. mixed source merge order
2. cursor pagination
3. org filtering
4. form submission filtering by org
5. empty states
6. partial-source failures if you choose fail-open behavior

### Integration tests

Cover endpoint returning:

1. appointment entry
2. task entry
3. SOAP/form entry
4. document entry
5. lab entry
6. invoice entry

### Regression focus

Verify no changes to existing endpoints:

1. appointment APIs
2. form SOAP APIs
3. document APIs
4. invoice APIs
5. lab APIs

## Recommended Failure Handling

Preferred: fail closed for endpoint-level invalid input, fail open for non-critical source loaders.

Meaning:

1. invalid org / companion / cursor => hard error
2. one source loader failing => log and omit that source, unless that failure indicates data corruption

If you choose fail-open, include optional diagnostics in logs only, not API response.

## Non-Goals for This Refactor

Do not include:

1. cross-organisation companion history
2. schema migration to add `organisationId` to documents
3. replacement of finance tab
4. replacement of current add-document workflow
5. changing current lab workspace behavior

## File Targets

Primary files likely to change:

1. [index.ts](/Users/harshitwandhare/Desktop/Yosemite-Crew/apps/backend/src/routers/index.ts)
2. `/Users/harshitwandhare/Desktop/Yosemite-Crew/apps/backend/src/routers/companion-history.router.ts`
3. `/Users/harshitwandhare/Desktop/Yosemite-Crew/apps/backend/src/controllers/web/companion-history.controller.ts`
4. `/Users/harshitwandhare/Desktop/Yosemite-Crew/apps/backend/src/services/companion-history.service.ts`
5. [form.service.ts](/Users/harshitwandhare/Desktop/Yosemite-Crew/apps/backend/src/services/form.service.ts)

## Acceptance Criteria

Backend is complete when:

1. frontend can call one org-scoped companion history endpoint
2. response contains normalized mixed entries
3. response is paginated
4. form submissions are included companion-wide, not only per appointment
5. existing appointment, finance, documents, and labs APIs remain unchanged
6. tests cover aggregation and scoping logic
