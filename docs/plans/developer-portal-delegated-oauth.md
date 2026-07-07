# Developer Portal - Delegated OAuth ("Sign in with Yosemite Crew")

## Document Status

- Owner: Developer portal workstream (epic #1582)
- Scope: `apps/backend` (OAuth endpoints, consent storage, delegated-token verification on the data plane), `apps/frontend` (client registration in `/developers`, consent screen, per-user grant management in account settings), `packages/database` (three new models, section 9)
- Depends on: ADR 0003 / PR #1763 (provider-neutral auth boundary with SuperTokens as the first adapter, unmerged as of 2026-07-07) - **hard implementation gate, see section 8**; the [Developer Data API contract](./developer-portal-data-api.md) (scope taxonomy, data plane, rate limiting)
- Related: [webhooks plan](./developer-portal-webhooks.md), [plugin registry plan](./developer-portal-plugin-registry.md), [ADR 0005](../adr/0005-ai-editing-agent-security-model.md)
- Status: Proposed - design for ratification now; implementation starts only after PR #1763 merges

---

## 1. Goal

Let a third-party application act **on behalf of an individual clinic user**, with that user's explicit consent, via OAuth 2.0 authorization code + PKCE. This complements org-level API keys: keys are for a developer's own server talking to its own org's data; delegated OAuth is for an app one developer builds and many clinic users sign into. "Sign in with Yosemite Crew" is the user-facing name for the consent flow.

### Non-goals

- **Not machine-to-machine auth.** Server-to-server integration stays on API keys (`yc_live_...` / `yc_test_...`); there is no client-credentials grant on this surface.
- **Not full OIDC in v1.** No `id_token`, no discovery document, no federation. A `profile:read` scope gives an app the acting user's display name and email, which covers the sign-in UX; formal OIDC conformance is a follow-on.
- **Not new data surface.** Delegated tokens hit the same `/v1/developer` data plane defined in the [data API contract](./developer-portal-data-api.md); no endpoint exists for OAuth that does not exist for keys.

## 2. Why org-level API keys are not enough

1. **Acting-user attribution.** A key resolves to `{ keyId, organisationId }`; every audit row says "the key did it". For an app a vet or receptionist uses interactively, compliance needs the acting human on the audit row. Delegated tokens carry a `userId`, so `AuditTrail` records the person, the client app, and the grant.
2. **Per-user permissions.** An org key carries whatever scopes an admin granted, org-wide; the RBAC layer (`withOrgPermissions` / `requirePermission`) never applies. A delegated token is bounded by the **intersection** of the scopes the user granted the app and the user's own live RBAC permissions - a receptionist using a third-party app cannot see more through the app than in the PIMS itself.
3. **Lifecycle granularity.** Staff leave. Revoking a shared org key breaks every consumer at once; a per-user grant is revoked for exactly one person, and a user removed from the org loses token power immediately (section 6).
4. **Consent.** Keys are issued by an org admin; the individuals whose actions flow through them never agreed to anything. Third-party apps require the individual's informed, per-app, per-org consent.

## 3. Protocol shape

Authorization code + PKCE only. `S256` is mandatory for **all** clients, including confidential ones. No implicit grant, no resource-owner-password grant. `state` is required and reflected verbatim.

| Endpoint                  | Auth                                                               | Purpose                                                                                     |
| ------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `GET /v1/oauth/authorize` | Interactive web session (`requireWebAuth`, ADR 0003)               | Render consent (or silently redirect if an active grant covers the request), issue the code |
| `POST /v1/oauth/token`    | PKCE verifier; client secret additionally for confidential clients | Exchange code for tokens; refresh grant                                                     |
| `POST /v1/oauth/revoke`   | Client authentication                                              | RFC 7009 revocation of an access or refresh token                                           |

This is a third mount, separate from both the management plane (`/v1/developers`, session) and the data plane (`/v1/developer`, key). Authorization codes are single-use, expire in 60 seconds, and are bound to the client id, the exact redirect URI, and the PKCE challenge.

## 4. Client registration

Developers register OAuth clients in the `/developers` portal (management plane, session auth), the same way they manage API keys:

- **App name** and **logo** - rendered on the consent screen exactly as registered; review-gated changes are an open question (section 12).
- **Redirect URIs** - exact-match only, `https` required, with a `http://localhost` exception for development clients. No wildcards, no path-prefix matching.
- **Client type** - `public` (mobile/SPA, no secret, PKCE only) or `confidential` (server-side, secret shown once at creation and stored hashed, same discipline as `DeveloperApiKey`).
- **Allowed scopes** - the subset of the canonical taxonomy the client may ever request; requests outside it fail at `/authorize`.

The consent screen displays the publisher (developer org) name, and unverified developer orgs (`Organization.isVerified` false) get a prominent warning banner.

## 5. Consent screen

Served by `/v1/oauth/authorize` when no active grant covers the requested scopes. It shows:

- app name, logo, publisher, and verification state;
- the requested scopes rendered in plain language from the canonical scope catalogue (never raw scope strings alone);
- the clinic organisation the grant applies to - if the user belongs to several orgs, they pick one; a grant is always bound to exactly one org;
- approve / deny. Deny redirects with `error=access_denied`.

Consent persists as an `OAuthAuthorization` row. While the grant is active, subsequent `/authorize` calls for the same client + org + scopes redirect silently. Requesting scopes beyond the grant re-prompts, showing only the delta.

## 6. Scope model

Reuses the canonical `resource:action` taxonomy from the [data API contract](./developer-portal-data-api.md) section 4 - `appointments:read`, `patients:read`, `encounters:read`, `invoices:read`, `organization:read` - plus one new scope:

- `profile:read` - the acting user's display name and email, powering the "signed in as" UX.

Rules specific to the delegated surface:

- `*` and the legacy coarse scopes (`read`, `write`, `admin`) are rejected outright; delegated grants are always enumerated.
- Write scopes become requestable only when the data API v1.1 write surface ships (its section 6 gates apply unchanged).
- **Effective permission = granted scopes INTERSECT the user's live RBAC permissions, evaluated at request time**, not consent time. A demoted user's tokens narrow immediately; a user removed from the org yields `403` on every call even with a formally active grant.

## 7. Tokens: lifetimes, refresh, revocation

All artifacts are opaque random strings, stored **SHA-256 hashed** (never plaintext), verified by hash lookup - the same discipline as `DeveloperApiKey`. Opaque-not-JWT is deliberate: revocation must be immediate, with no signed-token validity window to wait out.

| Artifact           | Prefix    | Lifetime               | Notes                                                                   |
| ------------------ | --------- | ---------------------- | ----------------------------------------------------------------------- |
| Authorization code | `yc_ac_`  | 60 seconds, single use | Bound to client + redirect URI + PKCE challenge                         |
| Access token       | `yc_uat_` | 1 hour                 | Sent as `Authorization: Bearer yc_uat_...` on the data plane            |
| Refresh token      | `yc_urt_` | 30 days rolling        | Rotated on every use; reuse of a rotated token revokes the whole family |

- **Rotation and reuse detection:** every refresh issues a new refresh token and marks the old one consumed; presenting a consumed refresh token is treated as theft and revokes the entire `familyId` lineage.
- **Absolute grant lifetime:** 12 months from consent, after which refresh fails and the user re-consents (annual re-confirmation of third-party access).
- **Revocation surfaces:** the user (account settings, per app), an org admin (all grants for a client within their org), the developer (deleting a client or rotating its secret revokes everything), the platform (suspending a client, mirroring plugin suspension), and the app itself (RFC 7009). All are immediate.

**Data plane acceptance:** the `/v1/developer` routes accept delegated bearer tokens alongside API keys; middleware branches on the token prefix. Delegated requests set `req.organisationId` (from the grant) plus `req.actingUserId`, then apply the section 6 intersection before `requireScope`. Rate limits apply per authorization at the same tiers as per-key limits; usage is metered against the client's developer org and counts toward its monthly quota. Delegated tokens are live-environment only in v1 (same sandbox deferral as the data API).

## 8. Relationship to the SuperTokens migration - implementation gate

ADR 0003 (PR #1763, **unmerged as of 2026-07-07**) introduces the provider-neutral auth boundary (`requireWebAuth`) that replaces direct Cognito verification. This feature is downstream of it in a load-bearing way:

- `/v1/oauth/authorize` requires an interactive human session. Today that would mean `authorizeCognito`, wiring consent identity to Cognito `sub` values that #1763 remaps via UserId-Mapping - every `OAuthAuthorization.userId` written before the migration would need rewriting after it.
- The consent screen, org membership check, and RBAC intersection all resolve the user through the auth boundary; building them twice is pure waste.

**Therefore: this design is ratifiable now, but implementation MUST NOT start before PR #1763 merges, and nothing from this plan ships to production before the provider-neutral boundary is live.** At implementation time, evaluate SuperTokens' OAuth2 provider tooling against section 9: adopting it may change where rows live, but the contract (endpoints, scopes, lifetimes, consent semantics) is defined here and does not move.

## 9. Data model field lists

Field lists only; Prisma modelling at implementation time following existing conventions (`organisationId` spelling, status enums, `@@unique` guards).

**OAuthClient** (owned by the publisher's developer org)

- id, developerOrganisationId, clientId (public identifier, unique), clientSecretHash (nullable - null for public clients), clientType (public | confidential)
- name, description (nullable), logoUrl (nullable), redirectUris (string[]), allowedScopes (string[], validated subset of the canonical list)
- status (active | suspended | deleted), createdBy, createdAt, updatedAt

**OAuthAuthorization** (one user's consent to one client in one org; unique per clientId + userId + organisationId)

- id, clientId, userId, organisationId
- grantedScopes (string[]), status (active | revoked), revokedBy (nullable: user | org_admin | developer | platform)
- consentedAt, lastUsedAt (nullable), revokedAt (nullable), createdAt, updatedAt

**OAuthToken** (one row per issued artifact; plaintext never stored)

- id, authorizationId, kind (code | access | refresh), tokenHash (SHA-256, unique)
- familyId (refresh-rotation lineage), scopes (string[] snapshot at issuance), pkceChallenge (nullable, codes only)
- expiresAt, consumedAt (nullable), revokedAt (nullable), createdAt

## 10. Security posture summary

PKCE S256 always; exact redirect matching; single-use short-lived codes; hashed artifacts; refresh rotation with family revocation; RBAC intersection at request time; immediate revocation on five surfaces; no wildcard scopes; consent UI shows publisher verification state; error redirects only ever target registered URIs (no open-redirect vector); every data-plane call made with a delegated token produces an audit row carrying userId, clientId, and authorizationId.

## 11. Dependencies and sequencing

1. **PR #1763 merges** (hard gate, section 8).
2. **PR #1696 + the data API mounting PR** - canonical scope validation, `requireScope`, per-key rate limiting, and metering are all reused, not rebuilt.
3. Then, in one workstream: the three models, the three OAuth endpoints, the data plane bearer branch, portal client registration, the consent screen, and account-settings grant management.

## 12. Open questions for the reviewer

1. OIDC conformance (id_token, discovery) as a v2 - is "Sign in with Yosemite Crew" as pure SSO (no data scopes) worth pulling forward?
2. Should org admins get an allowlist mode - staff can only consent to clients the org has pre-approved?
3. Is the 12-month absolute grant lifetime right for clinical integrations, or should enterprise orgs configure it?
4. Metering attribution: delegated calls count against the client developer's monthly quota (as designed) - or do heavy multi-user apps need a separate delegated pool and price?
5. Name/logo changes on a client with active grants: silent, or re-consent (impersonation guard)?
