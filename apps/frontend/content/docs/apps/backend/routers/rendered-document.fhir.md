---
id: backend-api-rendered-document.fhir
title: Rendered Document.Fhir API
slug: /apps/backend/api/rendered-document.fhir
---

Serves a previously-persisted rendered document (for example a signed form, a prescription, or an invoice) — its FHIR read view, its PDF, a re-render of that PDF, and a signing action. RBAC is resolved from the rendered document's own stored `organisationId` (via `withRenderedDocumentOrgPermissions`) rather than a caller-supplied one. A rendered document of kind `INVOICE` additionally requires the `billing:view:any` permission to be read, since invoices are financial rather than clinical data. Re-rendering and signing act on the record the document was produced from, so each kind takes the permission that record's own routes take: a `PRESCRIPTION` needs `prescription:edit:any`, or `prescription:edit:own` when the caller authored the prescription; every other kind needs `forms:edit:any`.

## Endpoints

### GET /organisation/:organisationId/:renderedDocumentId

- Auth: `requireWebAuth`
- RBAC: `withRenderedDocumentOrgPermissions, requirePermission` (any-of: `forms:view:any`, `prescription:view:any`)
- Params: `organisationId`, `renderedDocumentId`
- Controller: `RenderedDocumentFhirController.getRenderedDocument`
- Response: `200`: JSON (the rendered document read DTO via `toRenderedDocumentReadDto`), `403`: keys `message` — when the document is an `INVOICE` and the caller lacks `billing:view:any`

### GET /organisation/:organisationId/:renderedDocumentId/pdf

- Auth: `requireWebAuth`
- RBAC: `withRenderedDocumentOrgPermissions, requirePermission` (any-of: `forms:view:any`, `prescription:view:any`)
- Params: `organisationId`, `renderedDocumentId`
- Controller: `RenderedDocumentFhirController.getRenderedDocumentPdf`
- Response: `200`: PDF (`Content-Type`/`Content-Disposition: inline; filename="<filename>"` from the service), `403`: keys `message` — same `INVOICE` gate as above

### POST /organisation/:organisationId/:renderedDocumentId/rerender-pdf

- Auth: `requireWebAuth`
- RBAC: `withRenderedDocumentOrgPermissions, requirePermission` (any-of: `forms:edit:any`, `prescription:edit:any`, `prescription:edit:own`), then the per-kind permission above
- Params: `organisationId`, `renderedDocumentId`
- Controller: `RenderedDocumentFhirController.rerenderRenderedDocumentPdf`
- Response: `200`: PDF (`Content-Type`/`Content-Disposition: inline; filename="<filename>"` from the service); `403`: keys `message`, when the caller lacks the permission the document's kind takes

### POST /organisation/:organisationId/:renderedDocumentId/sign

- Auth: `requireWebAuth`
- RBAC: `withRenderedDocumentOrgPermissions, requirePermission` (any-of: `forms:edit:any`, `prescription:edit:any`, `prescription:edit:own`), then the per-kind permission above
- Params: `organisationId`, `renderedDocumentId`
- Body: `signRenderedDocumentSchema`
- Body fields: `signatureText`, `signedAt` (both optional)
- Controller: `RenderedDocumentFhirController.signRenderedDocument`
- Response: `200`: keys `documentId`, `signingUrl`; `401`: keys `message` — no authenticated user; `403`: keys `message`, when the caller lacks the permission the document's kind takes; `404`: keys `message` — signer's user record has no email on file; `409`: keys `message`, when the document is already signed or being signed, or the record it was produced from is not finalised (`COMPLETED`)
