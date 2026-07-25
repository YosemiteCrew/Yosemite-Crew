# SuperTokens Frontend Handover

**Scope:** `apps/frontend`
**Goal:** finish the web migration to SuperTokens while preserving the current product auth contract.

This document is the implementation handover for the frontend engineer. Backend auth is already migrated to the provider-neutral SuperTokens boundary.

## 1. What the frontend must do

- Replace direct Cognito/browser-token assumptions with the SuperTokens web SDK.
- Keep the existing auth store public API stable where possible.
- Use cookie-based session handling with automatic refresh.
- Support both web login outcomes:
  - staff email/password
  - password reset / email verification links
  - TOTP MFA challenge completion
- Treat the backend as the source of truth for:
  - session validity
  - profile (`pims_web` vs `pet_parent_mobile`)
  - email verification
  - MFA enforcement
  - logout / revocation

## 2. Current frontend entry points

Relevant files:

- [`./apps/frontend/src/app/lib/authClient.ts`](./apps/frontend/src/app/lib/authClient.ts)
- [`./apps/frontend/src/app/stores/authStore.ts`](./apps/frontend/src/app/stores/authStore.ts)
- [`./apps/frontend/src/app/features/auth/pages/SignIn/SignInPage.tsx`](./apps/frontend/src/app/features/auth/pages/SignIn/SignInPage.tsx)
- [`./apps/frontend/src/app/features/auth/pages/SignIn/SignIn.tsx`](./apps/frontend/src/app/features/auth/pages/SignIn/SignIn.tsx)
- [`./apps/frontend/src/app/features/auth/pages/SignUp/SignUpPage.tsx`](./apps/frontend/src/app/features/auth/pages/SignUp/SignUpPage.tsx)
- [`./apps/frontend/src/app/features/auth/pages/SignUp/SignUp.tsx`](./apps/frontend/src/app/features/auth/pages/SignUp/SignUp.tsx)
- [`./apps/frontend/src/app/features/auth/pages/ForgotPassword/ForgotPasswordPage.tsx`](./apps/frontend/src/app/features/auth/pages/ForgotPassword/ForgotPasswordPage.tsx)
- [`./apps/frontend/src/app/features/auth/pages/ForgotPassword/ForgotPassword.tsx`](./apps/frontend/src/app/features/auth/pages/ForgotPassword/ForgotPassword.tsx)
- [`./apps/frontend/src/app/features/auth/pages/ResetPassword/ResetPassword.tsx`](./apps/frontend/src/app/features/auth/pages/ResetPassword/ResetPassword.tsx)
- [`./apps/frontend/src/app/features/auth/pages/VerifyEmail/VerifyEmail.tsx`](./apps/frontend/src/app/features/auth/pages/VerifyEmail/VerifyEmail.tsx)

## 3. Pages that must complete the flow

The frontend engineer should complete the auth journey across these pages:

- `SignInPage` and `SignIn.tsx`
- `SignUpPage` and `SignUp.tsx`
- `ForgotPasswordPage` and `ForgotPassword.tsx`
- `ResetPassword.tsx`
- `VerifyEmail.tsx`

These pages must cover:

- staff sign-in
- passwordless/verification handoff where applicable
- forgot password
- reset password link flow
- email verification link flow
- MFA challenge handoff after login

## 4. Intended frontend auth flow

### Staff sign-in

1. User enters email and password.
2. Frontend calls the SuperTokens email/password recipe.
3. If email is unverified, show the verification flow.
4. If MFA is required, route the user into the TOTP challenge.
5. On success, call `/v1/auth/me` and hydrate the store from the normalized session.

### Password reset

1. User requests password reset.
2. Frontend uses the SuperTokens password reset flow.
3. User follows the emailed reset link.
4. After reset, re-enter through normal sign-in.

### Session bootstrap

1. On app load, check whether a session exists.
2. If yes, call `/v1/auth/me`.
3. Store the normalized auth payload in Zustand.
4. Drive app routing from the backend response, not from client-side token decoding.

## 5. Non-negotiable implementation rules

- Do not keep any Cognito-specific browser auth logic in the web app.
- Do not infer the current product profile from email.
- Do not use `localStorage` for bearer tokens.
- Do not derive business access from raw SuperTokens claim names.
- Do not trust frontend state alone for auth-sensitive decisions.

## 6. Required behavior

The frontend must correctly handle:

- signed-out state
- expired session state
- session refresh
- logout from any tab
- email verification required
- MFA required
- wrong-profile responses from the backend
- 401 and 403 responses from protected APIs

## 7. UI / UX expectations

- Keep the existing design system and auth screen structure.
- Surface backend errors clearly, but do not expose provider jargon.
- Show user-friendly copy for:
  - incorrect password
  - expired verification link
  - MFA required
  - session expired
  - sign-in not allowed

## 8. Backend endpoints the frontend must use

- `GET /v1/auth/me`
- `POST /v1/auth/logout`
- `GET /v1/auth/mfa/status`
- `POST /v1/auth/mfa/totp/enable`
- `POST /v1/auth/mfa/totp/disable`

Any auth UI change should be validated against these endpoints.

## 9. Testing required before merge

Run the frontend checks required by repo policy:

- `npx tsc --noemit`
- `pnpm --filter frontend run lint`
- targeted Jest tests for touched files

Add or update tests for:

- auth store session bootstrap
- sign-in success and failure states
- password reset flow
- email verification flow
- MFA challenge flow
- logout and session clearing
- wrong-profile / 403 handling

If a touched file already has a matching test in `src/app/__tests__/`, run that test file and fix any failures.

## 10. Suggested implementation order

1. Verify `authClient.ts` bootstrap is aligned with backend `/auth` settings.
2. Update the auth store to rely on SDK session state + `/v1/auth/me`.
3. Wire sign-in, verification, reset password, and MFA flows.
4. Validate route guards and post-login redirects.
5. Run the targeted test matrix.

## 11. Acceptance criteria

- Staff users can sign in with email/password.
- Staff users can complete verification and TOTP flows.
- The frontend reads the normalized session from the backend.
- Logout fully clears the web session.
- No Cognito-specific auth code remains in the web auth flow.
