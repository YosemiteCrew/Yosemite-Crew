# SuperTokens Mobile Handover

**Scope:** `apps/mobileAppYC`
**Goal:** finish the mobile auth migration to SuperTokens while preserving the current app login experience.

This document is the implementation handover for the mobile engineer. Backend auth is already migrated to the provider-neutral SuperTokens boundary.

## 1. What the mobile app must do

- Use SuperTokens React Native for session management.
- Keep passwordless email OTP as the primary pet-parent login path.
- Keep social login through the provider’s third-party flow where enabled.
- Treat backend auth as the source of truth for session validity, profile, and authorization.
- Remove any dependence on the old second auth provider / trigger backend path.

## 2. Current mobile auth entry points

Relevant files:

- [`apps/mobileAppYC/src/features/auth/services/passwordlessAuth.ts`](/Users/harshvardhan/Yosemite-Crew/apps/mobileAppYC/src/features/auth/services/passwordlessAuth.ts)
- [`apps/mobileAppYC/src/features/auth/services/socialAuth.ts`](/Users/harshvardhan/Yosemite-Crew/apps/mobileAppYC/src/features/auth/services/socialAuth.ts)
- [`apps/mobileAppYC/src/config/variables.ts`](/Users/harshvardhan/Yosemite-Crew/apps/mobileAppYC/src/config/variables.ts)
- [`apps/mobileAppYC/src/features/auth/thunks.ts`](/Users/harshvardhan/Yosemite-Crew/apps/mobileAppYC/src/features/auth/thunks.ts)
- [`apps/mobileAppYC/src/store/`](/Users/harshvardhan/Yosemite-Crew/apps/mobileAppYC/src/store/)

## 3. Intended mobile auth flow

### Email OTP sign-in

1. User enters email.
2. Mobile requests a passwordless code from the SuperTokens endpoint.
3. User enters the OTP.
4. Mobile consumes the OTP and establishes a session.
5. App syncs the authenticated user state from the backend.

### Social sign-in

1. User picks Apple / Google / Facebook.
2. Mobile completes the native provider step.
3. SuperTokens third-party sign-in creates or links the account.
4. App syncs the authenticated user state from the backend.

### Session bootstrap

1. On app start, check whether a session exists.
2. If yes, call the backend auth/session endpoint.
3. Hydrate Redux from the normalized session.
4. Route the user based on the backend auth state, not local assumptions.

## 4. Non-negotiable implementation rules

- Do not keep the old provider split in the mobile auth flow.
- Do not infer staff/mobile role from email address.
- Do not treat the recipe user id as the business id.
- Do not bypass the backend for auth-sensitive state.
- Do not keep login-state logic in screens if it belongs in services or thunks.

## 5. Required behavior

The mobile app must correctly handle:

- email OTP request / consumption
- expired OTP
- incorrect OTP
- session refresh
- logout
- account linking
- wrong-profile backend responses
- 401 and 403 from protected APIs

## 6. Backend endpoints the mobile app must align with

- `POST /auth/signinup/code`
- `POST /auth/signinup/code/consume`
- `GET /v1/auth/me`
- `POST /v1/auth/logout`

The current mobile auth helpers already use the passwordless recipe APIs; the remaining work is to ensure the rest of the app consumes the normalized backend session correctly.

## 7. Migration expectations for mobile

- Passwordless OTP remains the primary entry point for pet parents.
- Social login should continue to work through SuperTokens third-party providers.
- Sessions should survive app restarts through the SDK.
- Logout should clear both local app state and the backend session.
- User identity in app state should come from the backend session response.

## 8. Testing required before merge

Run the mobile checks required by repo policy:

- `npx tsc --noemit`
- `pnpm --filter mobileAppYC run lint`
- targeted Jest tests for touched files

Add or update tests for:

- OTP request flow
- OTP consumption success and failure
- social sign-in success and failure
- session bootstrap and restore
- logout and state reset
- backend error handling
- navigation after auth success / failure

If a touched file already has a matching test in `src/app/__tests__/`, run that test file and fix any failures.

## 9. Suggested implementation order

1. Verify the auth service helpers are fully SuperTokens-backed.
2. Confirm session bootstrap and refresh behavior.
3. Validate OTP and social sign-in flows end to end.
4. Wire Redux state and navigation to the backend session response.
5. Run the targeted test matrix.

## 10. Acceptance criteria

- Pet-parent login works via email OTP.
- Social login works via SuperTokens third-party flow.
- The app restores session state after restart.
- Logout fully clears the app and backend session.
- No legacy provider-specific auth flow remains in mobile.
