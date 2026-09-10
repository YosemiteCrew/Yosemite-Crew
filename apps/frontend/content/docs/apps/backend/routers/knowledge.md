---
id: backend-api-knowledge
title: Knowledge API
slug: /apps/backend/api/knowledge
---

Searches the Merck Veterinary Manual for clinical topics. The PMS route searches on behalf of a clinic (provider-facing content by default); the mobile route searches on behalf of a pet parent and always uses the consumer (`PAT`) audience. Both routes share a rate limiter (120 requests per 15 minutes, keyed to the session-verified caller) in front of the shared Merck credentials.

**Endpoints**

### GET /pms/organisation/:organisationId/merck/manuals/search

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `q`, `audience` (`PROV`|`PAT`), `language` (`en`|`es`), `media` (`hybrid`|`print`|`full`), `code`, `codeSystem`, `displayName`, `originalText`, `subTopicCode`, `subTopicDisplay`, `timezone` (falls back to the caller's saved profile timezone when omitted)
- Controller: `MerckController.searchManuals`
- Response: `200`: JSON (Merck search result with `meta.requestId` added), `400`: keys `message`, `code`, `requestId`

### GET /mobile/merck/manuals/search

- Auth: `requireMobileAuth`
- Query: `q`, `language` (`en`|`es`), `media` (`hybrid`|`print`|`full`), `code`, `codeSystem`, `displayName`, `originalText`, `subTopicCode`, `subTopicDisplay`, `timezone`
- Controller: `MerckMobileController.searchManuals`
- Response: `200`: JSON (Merck search result with `meta.requestId` added)
