# Merck Manuals Backend Requirements (HL7 Infobutton Production Guide)

## 1) Scope

This guide defines the backend work required so Yosemite Crew PMS can integrate Merck Manuals (MHL) in a production-grade, HL7 Infobutton-compliant way.

Frontend is already implemented and used in 3 places:

1. Integrations -> Merck card (enable/disable + view)
2. Main Merck page (`/integrations/merck-manuals`)
3. Embedded Merck module in Appointment View and Forms flow

The backend must preserve the existing frontend contract while translating to HL7 Infobutton request semantics upstream.

---

## 2) Current Status (Reality Check)

As of this implementation:

1. Frontend Merck integration exists and is mock/live switchable.
2. Frontend sends normalized search params (`q`, `audience`, `language`, `media`, optional refine fields).
3. Backend repo currently does **not** yet expose Merck endpoints.

Conclusion: end-to-end HL7 Infobutton compliance is **not complete yet**. It becomes compliant only after backend translation/mapping is implemented per this document.

---

## 3) Required PMS Endpoints

### 3.1 Integrations list (enhance existing)

`GET /v1/integration/pms/organisation/:organisationId`

Must include:

- `provider: "MERCK_MANUALS"`
- `status: "enabled" | "disabled" | "error" | "pending"`
- org-scoped metadata (`enabledAt`, `disabledAt`, `lastError`, etc. optional)

### 3.2 Enable Merck

`POST /v1/integration/pms/organisation/:organisationId/merck_manuals/enable`

### 3.3 Disable Merck

`POST /v1/integration/pms/organisation/:organisationId/merck_manuals/disable`

### 3.4 Search manuals

`GET /v1/knowledge/pms/organisation/:organisationId/merck/manuals/search`

Frontend query params (already live in frontend):

- `q` (required)
- `audience` (`PROV` | `PAT`)
- `language` (`en` | `es`)
- `media` (`hybrid` | `print` | `full`)
- optional: `code`, `codeSystem`, `displayName`, `originalText`, `subTopicCode`, `subTopicDisplay`

---

## 4) HL7 Infobutton Compliance Mapping (Mandatory)

Backend must map frontend params to MHL HL7 URL-based parameters.

| Frontend param    | MHL/HL7 upstream param                                  | Notes                                 |
| ----------------- | ------------------------------------------------------- | ------------------------------------- |
| `audience`        | `informationRecipient`                                  | `PROV`/`PAT`                          |
| `language`        | `informationRecipient.languageCode.c`                   | Vet content supports `en`, `es`       |
| `codeSystem`      | `mainSearchCriteria.v.cs` or `mainSearchCriteria.v.csn` | Support OID and csn names             |
| `code`            | `mainSearchCriteria.v.c`                                | Clinical code (ICD/LOINC/SNOMED etc.) |
| `displayName`     | `mainSearchCriteria.v.dn`                               | Keyword/display fallback              |
| `originalText`    | `mainSearchCriteria.v.ot`                               | Keyword fallback                      |
| `subTopicCode`    | `subTopic.v.c`                                          | MeSH code                             |
| `subTopicDisplay` | `subTopic.v.dn`                                         | MeSH display                          |
| (backend default) | `subTopic.v.cs=2.16.840.1.113883.6.177`                 | Required when subTopic used           |
| (backend default) | `taskContext.c.c=PROBLISTREV`                           | Recommended default                   |
| (backend config)  | `holder.assignedEntity.name.n`                          | Upstream username                     |
| (backend config)  | `holder.assignedEntity.certificateText.n`               | Upstream password                     |
| (backend default) | `knowledgeResponseType=text/json`                       | Prefer JSON/Atom-style payload        |

### Query fallback behavior

If `code` is missing:

1. Use `q` as fallback for `mainSearchCriteria.v.dn`
2. Also pass `mainSearchCriteria.v.ot=q`

If `code` is present:

1. Keep `mainSearchCriteria.v.c=code`
2. If `displayName` absent and `q` exists, set `mainSearchCriteria.v.dn=q`

### Cardinality support

MHL supports cardinality. Backend should be designed to support multiple codes in future (array input), even if frontend currently sends one code.

---

## 5) Upstream Target and URL Rules

Use veterinary base URL with **region-aware routing** based on frontend user profile timezone.

Primary veterinary upstreams:

- US/Canada endpoint: `https://www.merckvetmanual.com/custom/infobutton/search`
- Europe/Global endpoint: `https://www.msdvetmanual.com/custom/infobutton/search`

### 5.1 Timezone-based routing requirement

Backend must choose upstream base URL using the frontend user timezone (profile timezone, org/user preference, or explicit request timezone signal).

Routing policy:

1. If timezone resolves to US/Canada region, call `merckvetmanual.com`.
2. If timezone resolves to Europe (and all other non-US/Canada regions), call `msdvetmanual.com`.
3. If timezone is missing/invalid, default to `msdvetmanual.com` and log fallback reason.

Implementation note:

- Route decision should be centralized (single helper/service) and applied consistently across all 3 Merck search surfaces.
- Include selected upstream host in structured logs for traceability.

Response links returned to frontend must be restricted to allowed Merck/MSD domains:

- `merckvetmanual.com`
- `msdvetmanual.com`
- `merckmanuals.com`
- `msdmanuals.com`

---

## 6) Response Contract to Frontend

Backend may return either:

1. Normalized JSON (preferred), or
2. Raw Atom/JSON feed (frontend normalizes)

Preferred normalized shape:

```json
{
  "meta": {
    "requestId": "string",
    "source": "merck-live",
    "updatedAt": "2026-03-03T07:50:49Z",
    "audience": "PROV",
    "language": "en",
    "totalResults": 1
  },
  "entries": [
    {
      "id": "string",
      "title": "string",
      "summaryText": "string",
      "updatedAt": "2026-03-03T07:50:49Z",
      "audience": "PROV",
      "primaryUrl": "https://...",
      "subLinks": [
        { "label": "Full Summary", "url": "https://..." },
        { "label": "Etiology", "url": "https://...#..." }
      ]
    }
  ]
}
```

---

## 7) Auth, RBAC, Security

1. All APIs org-scoped and auth-protected.
2. Strict org isolation (no cross-org access).
3. Never expose Merck credentials to frontend.
4. Store credentials in backend env/secrets manager only.

Suggested envs:

- `MERCK_HEALTHLINK_USERNAME`
- `MERCK_HEALTHLINK_PASSWORD`
- `MERCK_HEALTHLINK_BASE_URL`
- `MERCK_HEALTHLINK_TIMEOUT_MS`

---

## 8) Errors, Resilience, Observability

Error payload:

```json
{
  "message": "Human readable message",
  "code": "MERCK_SEARCH_FAILED",
  "requestId": "trace-id"
}
```

HTTP guidance:

- `400` invalid params
- `401/403` auth/rbac failure
- `404` org/integration missing
- `429` rate limit
- `5xx` upstream/server failures

Operational requirements:

1. Timeout: 8-12s
2. Retry: max 1 on transient upstream failures
3. Per-org + per-user rate limiting
4. Structured logs with orgId, upstream status, latency, requestId

---

## 9) Compliance Acceptance Checklist (Backend)

- [ ] Merck provider appears in integrations response (`MERCK_MANUALS`)
- [ ] Enable/disable endpoints persist org-scoped status
- [ ] Search endpoint supports existing frontend params
- [ ] Backend maps frontend params to HL7 Infobutton upstream parameters (Section 4)
- [ ] Backend sends required Infobutton auth parameters upstream
- [ ] Upstream call uses veterinary MHL base URL
- [ ] Upstream host selection is timezone/profile-driven (US/Canada vs Europe/global)
- [ ] Response links are Merck/MSD-only domains
- [ ] Error contract and request tracing implemented
- [ ] Works identically in all 3 frontend Merck surfaces

---

## 10) Frontend/Backend Cutover Plan

1. Implement backend endpoints and mapping above.
2. Keep frontend on live backend integration (mock path removed).
3. Verify all 3 search surfaces.

---

## 11) Future Scope (Mobile Consumer-Only)

Mobile app can call the same search endpoint with:

- `audience=PAT`
- `language=en|es`
- optional refine params

No web iframe dependency is required for mobile; keep backend audience-driven so consumer-only mobile UI can reuse the same API.
