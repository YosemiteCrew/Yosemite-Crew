# PMS Web Auth Hardening Guide: Apple Passkeys + MFA/2FA (Frontend + Backend, Postgres-First)

## 1) Purpose

This guide defines an implementation-ready plan to add:

1. Passkey sign-in (including Apple iCloud Keychain passkeys via WebAuthn standard support in Safari/iOS/macOS).
2. Strong MFA/2FA for password-based sign-ins.
3. Production-grade auth hardening and observability.

Scope is the PMS web app (`apps/frontend`) and backend (`apps/backend`) with **Postgres-first design** for all new auth-security metadata.

This is a plan only. No runtime behavior changes are included in this document.

---

## 2) Current-State Audit (Repo-Specific)

## Frontend (current)

1. Auth is handled client-side in `apps/frontend/src/app/stores/authStore.ts` using `amazon-cognito-identity-js`.
2. Sign-in is password-based (`authenticateUser`) with no challenge orchestration for choice-based `USER_AUTH` passkey flows.
3. Signup uses Cognito `signUp` + email confirmation modal (`OtpModal`), then auto-sign-in.
4. API calls attach Cognito ID token from the store (`apps/frontend/src/app/services/axios.ts`).
5. Route guards are app-level (`ProtectedRoute`, `OrgGuard`) and depend on auth status from `authStore`.

## Backend (current)

1. Backend validates Cognito JWTs via JWKS (`apps/backend/src/middlewares/auth.ts`).
2. There is no dedicated PMS web sign-in/signup endpoint (web auth is effectively Cognito-direct from frontend).
3. Backend user bootstrap (`POST /fhir/v1/user`) trusts Cognito-authenticated token claims.
4. Backend is in dual-write/read-switch migration mode (`READ_FROM_POSTGRES`, `DUAL_WRITE_ENABLED`) and already has Prisma + Postgres schema.
5. New auth-security features should be implemented Postgres-first (no new Mongo dependency).

## Key gap summary

1. No passkey registration flow in app UX.
2. No `USER_AUTH` challenge orchestration (password vs `WEB_AUTHN` selection, challenge response).
3. No explicit MFA onboarding UX/API for TOTP at PMS web level.
4. No centralized auth event model in Postgres for audit/risk/incident response.

---

## 3) Standards And Non-Negotiable Security Rules

## Standards to align with

1. NIST SP 800-63B: provide phishing-resistant option; prefer cryptographic authenticators for high-assurance paths.
2. W3C WebAuthn L3: passkeys are multi-factor capable when user verification is enabled.
3. OWASP Authentication guidance: strict anti-enumeration, lockout/rate-limit, secure recovery, strong session controls.

## Service-specific Cognito constraints (important)

1. Cognito passkeys/passwordless and required-MFA have compatibility constraints.
2. In Cognito, when MFA is `required`, passwordless first factors (`WEB_AUTHN`, OTP) cannot be used as first auth factors.
3. Therefore, production design must explicitly choose one of these models:
   - Model A: Passkey-first + MFA optional with risk-based/role-based step-up.
   - Model B: Strict required MFA for all users, no passwordless first-factor sign-in.

Recommended for PMS: **Model A** (security + UX balance), with additional step-up controls for sensitive operations.

---

## 4) Target Architecture (Recommended)

## Decision

Move PMS web auth orchestration to a backend BFF layer while keeping Cognito as IdP.

Why:

1. Current frontend SDK (`amazon-cognito-identity-js`) is legacy-centric and not ideal for full `USER_AUTH` + passkey orchestration.
2. Backend orchestration gives central control for risk logic, consistent telemetry, and safer future policy changes.
3. Supports clean rollout while keeping token verification paths unchanged.

## Auth flow model

1. Primary options at sign-in:
   - Passkey (`WEB_AUTHN`) where available.
   - Password for users not enrolled in passkey.
2. MFA (TOTP) policy:
   - Required for password sign-ins for protected roles.
   - Optional but strongly encouraged for others.
   - Step-up required for sensitive actions (billing changes, org ownership transfers, security settings).
3. Passkey enrollment:
   - Performed post-auth using access token (`StartWebAuthnRegistration` -> `CompleteWebAuthnRegistration`).

## Apple passkey note

No Apple-specific protocol code is required in your web app.

1. Implement WebAuthn correctly.
2. Set Cognito RP ID/origin correctly.
3. Safari/iOS/macOS will use iCloud Keychain passkeys automatically.

---

## 5) Cognito Configuration Blueprint

Apply in AWS Console or IaC for the PMS user pool and app client(s).

1. Enable choice-based sign-in (`ALLOW_USER_AUTH`) in app client.
2. Configure `AllowedFirstAuthFactors` to include needed factors, e.g. `PASSWORD` and `WEB_AUTHN` (and optionally email/sms OTP if needed).
3. Configure `WebAuthnConfiguration`:
   - `RelyingPartyId`: PMS auth domain.
   - `UserVerification`: `required` for stronger assurance.
4. Keep MFA as `OPTIONAL` for passkey compatibility.
5. Enable TOTP software token MFA (`SoftwareTokenMfaConfiguration.Enabled = true`).
6. Enable threat protection (Plus plan) in audit mode first, then enforce with reviewed risk actions.
7. Enable refresh token rotation for app client and disable flows that conflict with it.
8. Ensure app client scopes include `aws.cognito.signin.user.admin` where required for passkey/MFA self-service APIs.

---

## 6) Backend Implementation Guide (Execution-Ready)

## 6.1 New backend module layout

Create a dedicated web-auth module:

1. `apps/backend/src/routers/auth-web.router.ts`
2. `apps/backend/src/controllers/web/auth-web.controller.ts`
3. `apps/backend/src/services/auth-web.service.ts`
4. `apps/backend/src/schemas/auth-web.schema.ts` (Zod validation)
5. `apps/backend/src/services/auth-security-audit.service.ts`

Register router in `apps/backend/src/routers/index.ts` under `/v1/auth/web`.

## 6.2 API contract (proposed)

1. `POST /v1/auth/web/signin/initiate`
   - Input: `{ username, preferredChallenge?: 'WEB_AUTHN'|'PASSWORD' }`
   - Calls Cognito `InitiateAuth(AuthFlow=USER_AUTH)`.
   - Output: challenge metadata + `session`.

2. `POST /v1/auth/web/signin/respond`
   - Input: `{ challengeName, session, challengeResponses }`
   - Calls `RespondToAuthChallenge`.
   - Output: tokens on success or next challenge.

3. `POST /v1/auth/web/signup`
   - Input: existing signup payload.
   - Calls Cognito sign-up and returns confirmation-needed status.

4. `POST /v1/auth/web/signup/confirm`
   - Input: `{ username, confirmationCode }`
   - Calls confirm-registration.

5. `POST /v1/auth/web/mfa/totp/associate`
   - Requires active auth session/token.
   - Calls `AssociateSoftwareToken`.

6. `POST /v1/auth/web/mfa/totp/verify`
   - Input: `{ code, sessionOrAccessToken }`
   - Calls `VerifySoftwareToken`.

7. `POST /v1/auth/web/mfa/preference`
   - Input: factor preference.
   - Calls `SetUserMFAPreference`.

8. `POST /v1/auth/web/passkey/registration/start`
   - Access-token authorized.
   - Calls `StartWebAuthnRegistration`.

9. `POST /v1/auth/web/passkey/registration/complete`
   - Access-token authorized.
   - Calls `CompleteWebAuthnRegistration`.

10. `GET /v1/auth/web/passkey/credentials`
    - Calls `ListWebAuthnCredentials`.

11. `DELETE /v1/auth/web/passkey/credentials/:credentialId`
    - Calls `DeleteWebAuthnCredential`.

12. `POST /v1/auth/web/signout/global`
    - Calls Cognito global sign-out + token revocation where applicable.

## 6.3 Postgres schema additions (Prisma)

Add new Postgres models in `apps/backend/prisma/schema.prisma` for security observability and policy enforcement.

Suggested models:

1. `AuthSecurityEvent`
   - `id`, `userId`, `eventType`, `channel`, `success`, `riskLevel`, `ip`, `userAgent`, `metadata`, timestamps.

2. `UserAuthMethod`
   - `id`, `userId`, `methodType` (`PASSWORD`, `PASSKEY`, `TOTP`), `isEnabled`, `isPreferred`, `lastUsedAt`, timestamps.

3. `AuthChallengeState` (short-lived)
   - `id`, `userId`, `sessionId`, `challengeName`, `expiresAt`, `consumedAt`, `metadata`.

4. `SecurityPolicyOverride` (optional admin controls)
   - `id`, `userId` or `role`, `requiresStepUp`, `expiresAt`, `reason`.

Notes:

1. Keep schema Prisma/Postgres-native; do not add new Mongo models.
2. Store minimal PII in events; hash IP if policy requires.

## 6.4 Security middleware and policy

1. Add `requireStepUpAuth` middleware for sensitive endpoints.
2. Validate recent strong auth context (`amr`, auth age, method used).
3. Reject high-risk operations without fresh step-up (e.g., <=10 minutes old).
4. Ensure all auth endpoints have strict rate limits (lower thresholds than global limiter).

## 6.5 Integration points to existing backend

1. Keep existing JWT verification middleware (`authorizeCognito`) for resource APIs.
2. Add helper for richer auth context extraction (method, auth_time, amr if present).
3. Keep `/fhir/v1/user` bootstrap behavior, but log auth-security event after bootstrap.

## 6.6 Backend test plan

1. Unit tests:
   - auth service challenge transitions.
   - Zod schema validation failures.
   - MFA/passkey API failure mapping.

2. Integration tests:
   - complete signin-initiate/respond happy paths.
   - passkey registration start/complete flow.
   - TOTP associate/verify/preference flow.
   - step-up protected route behavior.

3. Security tests:
   - brute-force/rate-limit behavior.
   - replayed/expired sessions rejected.
   - no token leakage in logs.

---

## 7) Frontend Implementation Guide (Execution-Ready)

## 7.1 High-level frontend strategy

Replace Cognito-direct orchestration in `authStore` with backend-auth API orchestration while preserving existing route guard model.

## 7.2 File-level changes

1. `apps/frontend/src/app/stores/authStore.ts`
   - Refactor `signIn`, `signUp`, `confirmSignUp`, `resendCode` to call new backend auth-web endpoints.
   - Add challenge-state support (`session`, `availableChallenges`, `selectedChallenge`).
   - Add methods:
     - `startPasskeyEnrollment`
     - `completePasskeyEnrollment`
     - `associateTotp`
     - `verifyTotp`
     - `setMfaPreference`

2. `apps/frontend/src/app/features/auth/pages/SignIn/SignIn.tsx`
   - Add challenge picker UI when backend returns available factors.
   - Implement passkey login trigger from challenge response.
   - Keep unconfirmed-user verification path, now via backend endpoint.

3. `apps/frontend/src/app/features/auth/pages/SignUp/SignUp.tsx`
   - Keep current signup UX.
   - After confirmation + first sign-in, offer passkey enrollment CTA.

4. `apps/frontend/src/app/ui/overlays/OtpModal/OtpModal.tsx`
   - Split responsibilities clearly:
     - email confirmation code path
     - MFA code path (if reused) or create dedicated `MfaModal`.

5. Create new settings UI:
   - `apps/frontend/src/app/features/settings/pages/SecuritySettings.tsx`
   - manage passkeys list, remove passkey, enable/disable TOTP, set preferred MFA.

6. `apps/frontend/src/app/services/axios.ts`
   - Keep token injection behavior but align refresh strategy with Cognito refresh-token-rotation requirements.

7. Route guards (`ProtectedRoute`, `OrgGuard`)
   - no large structural changes required.
   - add optional step-up gate component for security-sensitive pages/actions.

## 7.3 WebAuthn frontend handling notes

1. Convert Cognito `CredentialCreationOptions` JSON into browser `navigator.credentials.create` compatible object.
2. Convert binary fields (base64url <-> ArrayBuffer) correctly.
3. Send resulting `RegistrationResponseJSON`/`AuthenticationResponseJSON` back exactly as required by Cognito.
4. Handle browser support fallback gracefully.

## 7.4 UX policy recommendations

1. Default sign-in button order:
   - `Sign in with Passkey` (primary)
   - `Sign in with Password` (secondary)

2. If user has no passkey:
   - show one-click passkey enrollment after successful sign-in.

3. For admin/owner roles:
   - mandatory TOTP enrollment before allowing high-risk settings pages.

4. Recovery:
   - preserve password + verified email recovery path.
   - never rely on a single delivery channel for both OTP sign-in and MFA for the same user.

## 7.5 Frontend tests

1. `authStore` tests for challenge lifecycle.
2. SignIn tests for challenge selection (`WEB_AUTHN` vs password).
3. Passkey enrollment tests (mock `navigator.credentials`).
4. MFA setup tests (associate/verify/preference).
5. Regression tests for route guards and existing signout/session refresh behavior.

---

## 8) Postgres-First Data And Migration Notes

1. All new auth security state goes to Prisma models only.
2. Do not introduce new Mongo models for auth hardening features.
3. Use existing migration workflow (`pnpm --filter backend prisma:migrate`).
4. Keep dual-write/read-switch untouched for legacy domains; auth-security domain should be Postgres canonical from day one.

---

## 9) Rollout Plan (Safe Production Migration)

## Phase 0: Preparation

1. Add Cognito feature toggles in non-prod.
2. Deploy backend auth-web endpoints behind feature flag.
3. Add Postgres tables + audit logging only (no UX changes).

## Phase 1: Internal Beta (Staff only)

1. Enable passkey enrollment in security settings.
2. Keep password login as default for everyone.
3. Track auth success/failure, challenge errors, passkey registration success.

## Phase 2: Progressive Sign-in Upgrade

1. Show passkey button on sign-in.
2. For users with registered passkeys, prioritize passkey path.
3. Start mandatory TOTP for owner/admin password logins.

## Phase 3: Enforcement

1. Enforce step-up on critical operations.
2. Enforce risk-based adaptive controls in Cognito.
3. Enable stronger anomaly alerting and incident runbook.

## Phase 4: Hardening

1. Turn on stricter rate limits for auth endpoints.
2. Validate token revocation + global signout behavior across devices.
3. Pen-test auth and recovery paths.

---

## 10) Security Hardening Checklist

1. TLS everywhere; HSTS on frontend domain.
2. CSP + strict origin policy for auth pages.
3. CSRF protection for auth-web endpoints if cookie-based session is introduced.
4. Redact secrets/tokens in logs.
5. Structured audit logs for every auth decision.
6. Short-lived challenge sessions with one-time consumption.
7. Strict rate limiting per IP + per username + per device fingerprint.
8. Account lockout/backoff policy with alerting.
9. Token revocation on signout and suspicious activity.
10. Refresh token rotation enabled.
11. Security headers and anti-clickjacking for auth surfaces.
12. SOC2/GDPR-friendly retention policy for auth event data.

---

## 11) Environment Variables / Config Additions

Do not commit secrets. Add placeholders in `.env.example` files.

## Backend (`apps/backend/.env.example`)

1. `COGNITO_REGION`
2. `COGNITO_USER_POOL_ID`
3. `COGNITO_USER_POOL_ID_WEB`
4. `COGNITO_CLIENT_ID_WEB`
5. `COGNITO_CLIENT_SECRET_WEB` (only if confidential app client is used by backend)
6. `AUTH_WEB_FEATURE_ENABLED=true|false`
7. `AUTH_STEP_UP_WINDOW_SECONDS=600`
8. `AUTH_RISK_MODE=audit|enforce`

## Frontend (`apps/frontend/.env.example`)

1. `NEXT_PUBLIC_AUTH_WEB_FEATURE_ENABLED=true|false`
2. `NEXT_PUBLIC_PASSKEY_ENABLED=true|false`
3. `NEXT_PUBLIC_MFA_SETUP_ENABLED=true|false`

---

## 12) Implementation Task Breakdown For Future Agent

Use this sequence directly in implementation:

1. Add Prisma auth-security models and migration.
2. Build backend auth-web router/controller/service with Zod schemas.
3. Add backend integration tests for auth-web endpoints.
4. Add frontend auth service layer for new endpoints.
5. Refactor `authStore` to consume backend auth-web flows.
6. Implement passkey sign-in path in SignIn page.
7. Implement passkey enrollment + credential management in settings.
8. Implement TOTP setup/verify/preference UX.
9. Add step-up gate for critical operations.
10. Add dashboards/alerts for auth failures and risk events.
11. Run full QA matrix across browsers (Safari included for Apple passkeys).

---

## 13) Acceptance Criteria (Production-Ready)

1. Users can sign in with passkey where enrolled.
2. Users can still sign in with password if needed.
3. Password-based sign-in can require TOTP by policy.
4. Sensitive actions require recent step-up auth.
5. Auth security events are persisted in Postgres and searchable.
6. Token refresh/revocation behavior is deterministic and tested.
7. No auth secrets/tokens leak in logs.
8. Threat protection/risk controls are active and monitored.

---

## 14) Known Tradeoffs And Decisions

1. Cognito passkey + required-MFA conflict means you cannot have strict required MFA with passwordless first-factor at the same time.
2. Recommended compromise: MFA optional at pool level + enforced step-up in app policy for privileged operations.
3. If business demands "MFA required at every sign-in" for all users, disable passwordless first factors or move to custom auth challenge architecture.

---

## 15) Reference Links (Primary Sources)

1. Cognito authentication flows and choice-based `USER_AUTH`:
   - https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-authentication-flow-methods.html
2. Cognito MFA behavior and passkey compatibility constraints:
   - https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-mfa.html
3. Cognito passkey APIs:
   - https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_StartWebAuthnRegistration.html
   - https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_CompleteWebAuthnRegistration.html
   - https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_ListWebAuthnCredentials.html
   - https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_DeleteWebAuthnCredential.html
4. Cognito auth challenge APIs:
   - https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_InitiateAuth.html
   - https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_RespondToAuthChallenge.html
5. Cognito TOTP APIs:
   - https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AssociateSoftwareToken.html
   - https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_VerifySoftwareToken.html
   - https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_SetUserMFAPreference.html
6. Cognito refresh token rotation and revocation:
   - https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-the-refresh-token.html
   - https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_RevokeToken.html
7. Cognito threat protection:
   - https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-settings-threat-protection.html
8. NIST 800-63B phishing-resistant requirements:
   - https://pages.nist.gov/800-63-4/sp800-63b.html
9. W3C WebAuthn Level 3:
   - https://www.w3.org/TR/webauthn-3/
10. OWASP authentication guidance:

- https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

11. Apple passkeys documentation:

- https://developer.apple.com/documentation/authenticationservices/supporting-passkeys
