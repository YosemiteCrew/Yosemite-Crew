---
id: changelog
title: API Changelog
slug: /api/changelog
---

This page tracks changes to the Yosemite Crew developer-facing API surface, primarily the Developer Data API mounted at `/v1/developer`.

## Versioning policy

The policy is defined in the [Developer Data API v1 contract](https://github.com/YosemiteCrew/Yosemite-Crew/blob/dev/docs/plans/developer-portal-data-api.md):

- The API version is a path segment (`/v1/developer/...`).
- **Additive changes ship without a version bump.** New fields, new endpoints, and new optional query parameters may appear on `/v1` at any time. Clients must tolerate unknown fields.
- **Breaking changes require a new major version.** Removed or renamed fields, or changed semantics, ship as `/v2/developer/...` with a deprecation window during which `/v1` keeps working.
- The OpenAPI spec at `apps/dev-docs/static/openapi.yaml` is kept in lockstep with the contract: any PR that changes a data-plane route, parameter, or response shape must update the spec in the same PR. The spec is the generation source for SDK types and the MCP server's tool schemas, so drift breaks downstream tooling silently.

## How entries are added

This changelog is maintained by hand: the same PR that changes the API surface (and updates `static/openapi.yaml`) appends a plain markdown entry at the top of the Entries section below. Use this shape:

```markdown
## YYYY-MM-DD - Short title

- What changed, one bullet per change.
- Mark breaking changes explicitly with **Breaking:**.
```

No generation tooling is involved; keep entries short, factual, and newest-first.

## Entries

### 2026-07-07 - Developer Data API v1 contract published

- Initial v1 contract for the API-key-authenticated, org-scoped, read-only data plane at `/v1/developer`: appointments, patients, encounters, invoices, organization profile, and usage.
- Authentication via `Authorization: Bearer yc_live_...` (or `X-API-Key`), cursor pagination with a `pagination` envelope, a stable `message` plus `code` error envelope, per-key rate limits, and a 1,000 calls/month free tier.
- Write endpoints are named but deferred to v1.1.
- Contract: [docs/plans/developer-portal-data-api.md](https://github.com/YosemiteCrew/Yosemite-Crew/blob/dev/docs/plans/developer-portal-data-api.md)
