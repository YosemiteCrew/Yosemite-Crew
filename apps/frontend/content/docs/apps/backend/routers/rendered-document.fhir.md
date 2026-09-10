---
id: backend-api-rendered-document-fhir
title: Rendered Document Fhir API
slug: /apps/backend/api/rendered-document.fhir
---

API routes for the rendered document fhir feature.

**Endpoints**

### GET /organisation/:organisationId/:renderedDocumentId

- Auth: `requireWebAuth`
- Controller: `RenderedDocumentFhirController`

### GET /organisation/:organisationId/:renderedDocumentId/pdf

- Auth: `requireWebAuth`
- Controller: `RenderedDocumentFhirController`

### POST /organisation/:organisationId/:renderedDocumentId/rerender-pdf

- Auth: `requireWebAuth`
- Controller: `RenderedDocumentFhirController`

### POST /organisation/:organisationId/:renderedDocumentId/sign

- Auth: `requireWebAuth`
- Controller: `RenderedDocumentFhirController`
