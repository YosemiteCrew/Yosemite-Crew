---
id: backend-api-code
title: Code API
slug: /apps/backend/api/code
---

Looks up clinical coding data: internal code entries and cross-system mappings, VeNom/SNOMED clinical term suggestions (VeNom is the UK veterinary clinical terminology; SNOMED is the broader human/veterinary clinical terminology), and ATCvet medication suggestions (the WHO anatomical therapeutic chemical classification for veterinary medicines). Every endpoint has a `/mobile`-prefixed twin so the mobile app can read the same data under mobile authentication.

**Endpoints**

### GET /entries

- Auth: `requireWebAuth`
- Query: `system`, `type`, `active`, `q`, `limit`
- Controller: `CodeController.listEntries`

### GET /mappings

- Auth: `requireWebAuth`
- Query: `sourceSystem`, `sourceCode`, `targetSystem`, `targetCode`, `active`
- Controller: `CodeController.listMappings`

### GET /terms/suggest

- Auth: `requireWebAuth`
- Query: `q`, `domain` (`ReasonForVisit`, `PresentingComplaint`, `DiagnosticTest`, `Diagnosis`, `Procedure`), `vocabulary` (`VENOM` or `SNOMED`), `species`, `limit`
- Controller: `CodeController.suggestTerms`
- Response: `200`: keys `items`, `400`: keys `message`, `error`

### GET /medications/suggest

- Auth: `requireWebAuth`
- Query: `q`, `group` (ATCvet anatomical main group, e.g. `QJ`), `species`, `limit`
- Controller: `CodeController.suggestMedications`
- Response: `200`: keys `items`, `400`: keys `message`, `error`

### GET /mobile/entries

- Auth: `requireMobileAuth`
- Query: `system`, `type`, `active`, `q`, `limit`
- Controller: `CodeController.listEntries`

### GET /mobile/mappings

- Auth: `requireMobileAuth`
- Query: `sourceSystem`, `sourceCode`, `targetSystem`, `targetCode`, `active`
- Controller: `CodeController.listMappings`

### GET /mobile/terms/suggest

- Auth: `requireMobileAuth`
- Query: `q`, `domain` (`ReasonForVisit`, `PresentingComplaint`, `DiagnosticTest`, `Diagnosis`, `Procedure`), `vocabulary` (`VENOM` or `SNOMED`), `species`, `limit`
- Controller: `CodeController.suggestTerms`
- Response: `200`: keys `items`, `400`: keys `message`, `error`

### GET /mobile/medications/suggest

- Auth: `requireMobileAuth`
- Query: `q`, `group` (ATCvet anatomical main group, e.g. `QJ`), `species`, `limit`
- Controller: `CodeController.suggestMedications`
- Response: `200`: keys `items`, `400`: keys `message`, `error`
