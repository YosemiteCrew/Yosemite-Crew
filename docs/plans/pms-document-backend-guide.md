# PMS Document Upload: Backend Patch Guide

## Context

Frontend PMS document upload now captures these fields:

- `visitType`
- `issuingBusinessName`
- `issueDate`

Current backend PMS create path drops these fields while creating the document.

## Required Change

Update PMS create flow to forward these fields to `DocumentService.create`.

### File

`apps/backend/src/controllers/app/document.controller.ts`

### Function

`createDocumentPms`

### Patch

In the object passed to `DocumentService.create`, include:

```ts
visitType: body.visitType,
issuingBusinessName: body.issuingBusinessName,
issueDate: body.issueDate,
```

So this block:

```ts
const created = await DocumentService.create(
  {
    companionId,
    title: body.title!,
    category: body.category!,
    subcategory: body.subcategory,
    attachments: body.attachments ?? [],
    appointmentId: body.appointmentId ?? null,
  },
  {
    pmsUserId: pmsUserId,
    organisationId,
  }
);
```

becomes:

```ts
const created = await DocumentService.create(
  {
    companionId,
    title: body.title!,
    category: body.category!,
    subcategory: body.subcategory,
    attachments: body.attachments ?? [],
    appointmentId: body.appointmentId ?? null,
    visitType: body.visitType,
    issuingBusinessName: body.issuingBusinessName,
    issueDate: body.issueDate,
  },
  {
    pmsUserId: pmsUserId,
    organisationId,
  }
);
```

## Optional Hardening (Recommended)

In `DocumentService.update`, allow clearing issue date and visit/business values when explicitly sent as `null` or empty string.

Current update logic only updates when truthy, which prevents clearing some fields.

## Verification

Run:

```bash
cd apps/backend
npx jest --watchman=false --testPathPattern="app/document.controller.test.ts"
pnpm run type-check
pnpm run lint
```

## Suggested Test Addition

In `apps/backend/test/controllers/app/document.controller.test.ts`, extend `createDocumentPms should success (201)` to assert `DocumentService.create` receives `visitType`, `issuingBusinessName`, and `issueDate`.
