# 0003. Provider-neutral auth boundary with SuperTokens as the first adapter

**Status:** Proposed
**Date:** 2026-07-02

## Context

Authentication is coupled to a single hosted identity provider at every layer: the web app performs SRP sign-in directly from the browser with a provider SDK and stores tokens in `localStorage`, the mobile app splits authentication across two providers (hosted email-OTP plus a second provider for social login), and the backend verifies bearer JWTs against two provider-specific JWKS endpoints in one middleware file that nearly every router imports by provider name. The provider's user id (`sub`) is also the join key across the data model (`User.userId`, `AuthUserMobile.providerUserId`, `OrganisationRoomStaff.staffUserId`, practitioner references), so any migration that changes user ids would silently orphan org membership, RBAC, and historical attribution.

Three forces shaped the decision:

1. **Provider independence.** The project wants to be able to swap or add identity providers (OIDC, Keycloak, etc.) later without touching product code again.
2. **Zero business-data rewrite.** ~80 backend files and several denormalized columns key off the existing provider user id. Re-keying business data during an auth migration is the riskiest possible variant of this work and buys nothing functionally.
3. **Brownfield reality.** A SuperTokens foundation (recipes, session helpers, MFA scaffolding) already exists in `packages/auth` behind an env-driven gate, and the two products need different login methods (staff web: password + MFA; pet-parent mobile: email OTP + social).

## Decision

Introduce a provider-neutral auth boundary in `packages/auth` — an `AuthProvider` interface, an `AuthService` facade, and a `createAuthProvider(AUTH_PROVIDER)` factory — and migrate both products to SuperTokens as the first adapter, in one coordinated cutover with a short, flag-gated legacy-token grace window.

Specifically:

- **Provider code is quarantined.** Only `packages/auth/src/providers/<name>/` (and the SuperTokens init/config that lives beside it in `packages/auth`) may import a provider SDK; product code consumes the normalized `AuthSession` through neutral middleware and never sees provider types. A lint guard enforces this.
- **The internal app user id is the existing stable key.** Migrated users are pre-provisioned into SuperTokens with a user-id mapping whose external id equals their existing provider `sub`, so `session.getUserId()` returns the id every existing row already stores. New users use the new provider's native id. An `AuthIdentity` table (`provider`, `providerUserId` → `appUserId`, unique per provider identity) records the mapping provider-neutrally so future providers map to the same internal id.
- **Per-product auth profiles.** `pims_web` (staff): email + password with required MFA (TOTP now; WebAuthn/passkey is a planned upgrade, the recipe surface already supports it). `pet_parent_mobile`: email OTP + Apple/Google/Facebook through the provider's third-party recipe, replacing the second provider entirely. The profile is stamped into the session as a claim and enforced per route group, so a mobile session cannot exercise staff routes.
- **Sessions:** cookie-based for web (httpOnly, revocable server-side — replacing bearer tokens in `localStorage`), header-based for mobile (SDK-managed refresh, Keychain-backed).
- **Cutover and rollback:** deployment-time selection via `AUTH_PROVIDER`; a time-boxed grace window (`AUTH_LEGACY_TOKEN_GRACE`) dual-accepts legacy bearer tokens using pure JWKS verification (no legacy SDK needed) so in-flight sessions and not-yet-updated mobile builds keep working; the existing disable flag remains the kill-switch. Migrated web users set their password on first use via the password-reset link (legacy password hashes are not portable; their address is imported pre-verified), then enroll MFA. The product profile is derived from the login method - email and password is the staff-web first factor, email OTP and social are the pet-parent product - so it is never inferred from the email address, which would misclassify a person who is both staff and a pet owner under one address.

## Consequences

**Good:**

- Adding a future provider is an adapter + identity mapping, with zero product-code change — the acceptance criterion of epic #1672.
- No business-data rewrite: every existing foreign key and request-scoping check keeps working because the internal id is preserved through the mapping.
- Web sessions become server-revocable (logout today is client-side only; refresh tokens outlive it). Auth routes gain a dedicated rate limiter they previously bypassed.
- The mobile app drops from two auth providers to one, and its hosted trigger backend is retired.

**Bad / accepted trade-offs:**

- One large coordinated PR across backend, web, and mobile rather than per-surface releases; mitigated by the grace window, the kill-switch, pre-provisioning rehearsal on staging, and the fact that the boundary itself is additive until the middleware swap.
- The grace window keeps a legacy JWT verifier in the tree (quarantined under `providers/`) until it is removed in a follow-up; during that window a revoked legacy token remains valid until expiry, exactly as today.
- Web email verification and password reset move from 6-digit codes to emailed links (provider-standard); sign-in gains an MFA step for staff. These are deliberate UX changes, not regressions.
- Legacy user records with an untrustworthy `authProvider` value (a known data bug) must be partitioned by id shape/issuer during pre-provisioning, not by the stored column.

## Alternatives considered

- **Direct SDK swap without an abstraction.** Rejected: leaves product code coupled to the new provider and forces a third migration for any future provider change.
- **Re-keying business data to brand-new internal ids.** Rejected for v1: highest-risk option, no functional benefit over preserving the stable id behind the mapping table; the `AuthIdentity` table leaves incremental re-keying open if ever wanted.
- **Per-surface incremental cutover (web first, mobile later).** Rejected: it would require running three token formats and both verification stacks in production for months; the grace window achieves the same safety with a bounded lifetime.
- **Keeping the second provider for mobile social login as a permanent bridge.** Rejected: it would leave the mobile app permanently dual-provider; the third-party recipe covers all three social providers (Apple uses the authorization-code flow).
