# SuperTokens Migration - Engineering Guide (#1672)

**Scope:** web (PIMS staff) + mobile (pet parents) + backend, in one coordinated cutover.
**Architecture decision:** see [ADR 0003](../adr/0003-provider-neutral-auth-boundary-supertokens.md).
**Status:** code complete behind deployment flags; cutover is an ops action (below).

> Security note: this public guide contains no environment values, pool or
> client identifiers, or connection URIs. Operational values live in the
> deployment secret store; the env variable _names_ are documented in
> `apps/backend/.env.example`.

## 1. Target architecture (what shipped)

- `packages/auth` hosts the provider-neutral boundary: `AuthProvider`
  interface, `AuthService`, `createAuthProvider(AUTH_PROVIDER)`, normalized
  `AuthSession`, and neutral express session middleware with per-profile
  enforcement. Provider SDK code lives only under `packages/auth/src/providers/`
  and the SuperTokens init/config beside it; an eslint guard blocks provider
  SDK imports from backend product code.
- Two auth profiles, stamped into the session as a claim and enforced per
  route group:
  - `pims_web` (staff): email + password, **required MFA** (TOTP; email OTP
    doubles as the no-lockout first-login/recovery factor), email
    verification required, cookie sessions (httpOnly, server-revocable).
  - `pet_parent_mobile`: email OTP + Apple/Google/Facebook through the
    provider's third-party recipe (native SDK token acquisition unchanged),
    header-based sessions with SDK-managed refresh.
- Identity strategy (zero business-data rewrite): migrated users are
  pre-provisioned with a user-id mapping whose external id equals their
  pre-existing stable app user id, so `session.getUserId()` returns the id
  every table already stores. `auth_identities` records each provider
  identity -> app user id pair; future providers map to the same internal id.
- Neutral endpoints: `GET /v1/auth/me` (normalized session) and
  `POST /v1/auth/logout` (server-side revocation). TOTP management under
  `/v1/auth/mfa/*`. Provider recipe routes are auto-served at the auth base
  path and sit behind a dedicated rate limiter.

## 2. Deployment-time configuration

- `AUTH_PROVIDER=supertokens` selects the adapter; invalid config fails fast
  at startup.
- `SUPERTOKENS_DISABLED=true` is the kill-switch (auth routes fail closed
  with 503; nothing else breaks).
- `AUTH_LEGACY_TOKEN_GRACE=true` enables the time-boxed grace verifier that
  accepts residual legacy bearer tokens (pure JWKS verification, no legacy
  SDK), preserving the legacy pools' product separation. Remove after the
  window closes.
- `AUTH_REQUIRE_MFA=false` exists for CI/e2e only - never production.

## 3. Cutover runbook (ops)

1. **Staging dress rehearsal first.** Provision the core (managed cloud),
   set env, run the pre-provisioning tool, smoke-test all flows, only then
   repeat in production.
2. **Pre-provision users** (idempotent, re-runnable):
   `pnpm --filter backend exec tsx scripts/preprovision-supertokens.ts
--staff <web-pool-export.json> --mobile [--dry-run]`
   - Staff: created as EmailPassword users with random throwaway passwords
     (never stored/logged), verified emails, user-id mapping to the existing
     app user id, and name/role copied to user metadata.
   - Mobile: identities from `AuthUserMobile` become Passwordless users;
     the Parent-linked identity wins the id mapping. The legacy
     `authProvider` column is never trusted (historical write bug, fixed in
     this migration).
3. **Deploy with** `AUTH_LEGACY_TOKEN_GRACE=true`. Migrated staff set their
   password on first use via the password-reset link (their address is
   imported pre-verified), then enroll TOTP; the staff-web profile is keyed
   to the email-and-password first factor, so first login is password-reset,
   not OTP. Mobile users on old app builds keep working through the grace
   verifier until they update.
4. **Monitor** auth error rates (401/403/refresh) live; the kill-switch and
   the grace flag are the rollback rails.
5. **Close the window** (24-72h after the mobile fleet converges): set
   `AUTH_LEGACY_TOKEN_GRACE=false`, then delete
   `packages/auth/src/providers/legacy-cognito/` and the legacy env names in
   a follow-up cleanup PR. Decommission the legacy pools only after zero
   token-refresh activity is observed for a sustained period.

## 4. What changed per surface

- **Backend:** one middleware file swap (`requireWebAuth` /
  `requireMobileAuth`, same `AuthenticatedRequest` contract and module path);
  the only legacy admin SDK call (name sync) now goes through the boundary;
  mobile signup records the true provider.
- **Web:** the Zustand auth store keeps its public contract but is backed by
  the SuperTokens web SDK; bearer tokens in localStorage are replaced by
  httpOnly cookies with automatic refresh; email verification and password
  reset move from 6-digit codes to emailed links; sign-in gains an MFA step;
  a Security settings section manages TOTP.
- **Mobile:** email OTP and social exchange go through the provider (native
  social SDKs unchanged); the app drops its second auth provider and its
  hosted trigger backend; sessions are SDK-managed header tokens.

## 5. Adding a future provider

Implement `AuthProvider` under `packages/auth/src/providers/<name>/`, add a
case to `createAuthProvider`, map identities into `auth_identities` with the
same app user id, and select it via `AUTH_PROVIDER`. No product-code change.
