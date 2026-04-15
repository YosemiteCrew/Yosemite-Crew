# SuperTokens Migration Plan — mobileAppYC + Backend

**Goal:** Replace AWS Cognito (email/OTP auth) and Firebase Auth (social login) with SuperTokens self-hosted.  
**Scope:** `apps/mobileAppYC` + `apps/backend`  
**Estimated effort:** 3–5 days  
**Risk level:** High — touches every authenticated API call. Must be done behind a feature flag with a dual-verify period.

---

## Current Auth Architecture (what we're replacing)

```
Mobile App
├── Email/OTP login      → AWS Cognito (via aws-amplify/auth)
├── Google login         → Firebase Auth (via @react-native-google-signin)
├── Apple login          → Firebase Auth (via @invertase/react-native-apple-authentication)
├── Facebook login       → Firebase Auth (via react-native-fbsdk-next)
├── Session management   → sessionManager.ts (custom, uses Keychain)
└── Account deletion     → deleteAmplifyAccount() + deleteFirebaseAccount()

Backend
├── authorizeCognito         → verifies Cognito JWTs (web/dashboard routes)
├── authorizeCognitoMobile   → verifies Cognito or Firebase JWTs (mobile routes)
├── AuthUserMobile model     → stores { authProvider: "cognito"|"firebase", providerUserId }
└── AuthUserMobileService    → createOrGetAuthUser() maps provider + userId → internal user
```

### Key files to change

| File                                                              | What changes                                                                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `apps/mobileAppYC/src/features/auth/services/passwordlessAuth.ts` | Full rewrite — remove all `aws-amplify/auth` calls                                                                             |
| `apps/mobileAppYC/src/features/auth/services/socialAuth.ts`       | Remove `signInWithCredential(firebase)`. Keep native Google/Apple/Facebook token acquisition. Add SuperTokens `/signinup` call |
| `apps/mobileAppYC/src/features/auth/services/accountDeletion.ts`  | Replace Amplify + Firebase delete with SuperTokens admin API call                                                              |
| `apps/mobileAppYC/src/features/auth/sessionManager.ts`            | Replace `fetchAuthSession` (Amplify) and `getIdToken` (Firebase) with `supertokens-react-native` session                       |
| `apps/mobileAppYC/src/features/auth/services/tokenStorage.ts`     | Add `'supertokens'` to `AuthProviderName` type, remove `'amplify'` \| `'firebase'`                                             |
| `apps/mobileAppYC/src/features/auth/thunks.ts`                    | Update `logout` thunk — remove Amplify/Firebase sign-out calls                                                                 |
| `apps/backend/src/middlewares/auth.ts`                            | Add `authorizeSupertokens` middleware. Keep old ones during transition                                                         |
| `apps/backend/src/models/authUserMobile.ts`                       | Add `'supertokens'` to `authProvider` enum                                                                                     |
| `apps/backend/prisma/schema.prisma`                               | Add `supertokens` to `AuthProvider` enum, migrate                                                                              |
| `apps/backend/src/app.ts`                                         | Add SuperTokens middleware init                                                                                                |

---

## Phase 0 — Infrastructure Setup (Day 0, ~2 hours)

### 0.1 Run SuperTokens Core via Docker

Add to your Railway deployment (or `docker-compose.yml` for local dev):

```yaml
supertokens:
  image: registry.supertokens.io/supertokens/supertokens-postgresql:latest
  environment:
    POSTGRESQL_CONNECTION_URI: '${DATABASE_URL}'
    # Optional API key to restrict access to core
    SUPERTOKENS_API_KEY: '${SUPERTOKENS_API_KEY}'
  ports:
    - '3567:3567'
  restart: unless-stopped
```

SuperTokens Core listens on port `3567`. Your backend connects to it at `http://localhost:3567` (or Railway internal URL).

Add to backend `.env`:

```
SUPERTOKENS_CONNECTION_URI=http://localhost:3567
SUPERTOKENS_API_KEY=your-random-secret-here
```

### 0.2 Install backend dependencies

```bash
pnpm --filter api add supertokens-node
```

### 0.3 Install mobile dependencies

```bash
pnpm --filter mobileAppYC add supertokens-react-native
```

---

## Phase 1 — Backend: SuperTokens Init + New Middleware (Day 1, ~3 hours)

### 1.1 Initialize SuperTokens in `app.ts`

In `apps/backend/src/app.ts`, add SuperTokens middleware **before** your existing routes:

```ts
// apps/backend/src/app.ts
import supertokens from 'supertokens-node';
import {
  middleware as stMiddleware,
  errorHandler as stErrorHandler,
} from 'supertokens-node/framework/express';
import Session from 'supertokens-node/recipe/session';
import ThirdParty from 'supertokens-node/recipe/thirdparty';
import Passwordless from 'supertokens-node/recipe/passwordless';

supertokens.init({
  framework: 'express',
  supertokens: {
    connectionURI: process.env.SUPERTOKENS_CONNECTION_URI!,
    apiKey: process.env.SUPERTOKENS_API_KEY,
  },
  appInfo: {
    appName: 'YosemiteCrew',
    apiDomain: process.env.API_DOMAIN!, // e.g. https://api.yosemitecrew.com
    websiteDomain: process.env.WEB_DOMAIN!, // e.g. https://app.yosemitecrew.com
    apiBasePath: '/v1/auth',
    websiteBasePath: '/auth',
  },
  recipeList: [
    ThirdParty.init({
      signInAndUpFeature: {
        providers: [
          {
            config: {
              thirdPartyId: 'google',
              clients: [
                {
                  clientId: process.env.GOOGLE_CLIENT_ID!,
                  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
                },
              ],
            },
          },
          {
            config: {
              thirdPartyId: 'apple',
              clients: [
                {
                  clientId: process.env.APPLE_BUNDLE_ID!, // bundle identifier, not service ID, for native iOS
                  additionalConfig: {
                    keyId: process.env.APPLE_KEY_ID!,
                    privateKey: process.env.APPLE_PRIVATE_KEY!,
                    teamId: process.env.APPLE_TEAM_ID!,
                  },
                },
              ],
            },
          },
          {
            config: {
              thirdPartyId: 'facebook',
              clients: [
                {
                  clientId: process.env.FACEBOOK_APP_ID!,
                  clientSecret: process.env.FACEBOOK_APP_SECRET!,
                },
              ],
            },
          },
        ],
      },
    }),
    Passwordless.init({
      contactMethod: 'EMAIL',
      flowType: 'USER_INPUT_CODE', // OTP flow matching your current 4-digit code UX
      emailDelivery: {
        // Wire into your existing SES email service here, or use Resend once migrated
        override: (originalImplementation) => {
          return {
            ...originalImplementation,
            sendEmail: async (input) => {
              // Call your existing email util:
              // await sendEmail({ to: input.email, templateId: 'otp', data: { code: input.userInputCode } })
              await originalImplementation.sendEmail(input);
            },
          };
        },
      },
    }),
    Session.init(),
  ],
});

export function createApp() {
  const app = express();
  // ... existing setup ...

  // Add SuperTokens CORS headers (needed for web dashboard)
  app.use(
    cors({
      origin: process.env.WEB_DOMAIN,
      allowedHeaders: ['content-type', ...supertokens.getAllCORSHeaders()],
      credentials: true,
    })
  );

  // SuperTokens middleware — exposes /v1/auth/* routes automatically
  app.use(stMiddleware());

  // ... your existing routes ...

  // SuperTokens error handler — must be after routes
  app.use(stErrorHandler());

  return app;
}
```

### 1.2 Add new `authorizeSupertokens` middleware

In `apps/backend/src/middlewares/auth.ts`, add alongside existing middleware (do not delete old ones yet):

```ts
import { verifySession } from 'supertokens-node/recipe/session/framework/express';
import type { SessionRequest } from 'supertokens-node/framework/express';

/**
 * SuperTokens session verification middleware.
 * Drop-in replacement for authorizeCognito / authorizeCognitoMobile.
 * Populates req.userId, req.email, req.provider on success.
 */
export const authorizeSupertokens = [
  verifySession(),
  async (req: Request, res: Response, next: NextFunction) => {
    const sessionReq = req as SessionRequest;
    const session = sessionReq.session!;

    (req as AuthenticatedRequest).userId = session.getUserId();
    (req as AuthenticatedRequest).provider = 'supertokens';

    // Fetch email from session metadata or SuperTokens user record
    try {
      const userInfo = await supertokens.getUser(session.getUserId());
      const emailEntry = userInfo?.emails?.[0];
      (req as AuthenticatedRequest).email = emailEntry;
    } catch {
      // non-fatal — email enrichment only
    }

    next();
  },
];
```

### 1.3 Update `AuthUserMobile` model — add `supertokens` provider

In `apps/backend/src/models/authUserMobile.ts`:

```ts
// Before:
authProvider: "cognito" | "firebase"

// After:
authProvider: "cognito" | "firebase" | "supertokens"

// Schema enum:
enum: ["cognito", "firebase", "supertokens"],
```

In `apps/backend/prisma/schema.prisma`:

```prisma
enum AuthProvider {
  cognito
  firebase
  supertokens   // add this
}
```

Run: `pnpm --filter api run prisma migrate dev --name add_supertokens_provider`

### 1.4 Update `AuthUserMobileService.createOrGetAuthUser`

The service already accepts a provider string — just ensure `'supertokens'` routes correctly:

```ts
// apps/backend/src/services/authUserMobile.service.ts
async createOrGetAuthUser(
  authProvider: "cognito" | "firebase" | "supertokens",
  providerUserId: string,
  email: string,
): Promise<AuthUserMobile> {
  // No other change needed — logic is provider-agnostic
}
```

### 1.5 Add SuperTokens account deletion endpoint

SuperTokens exposes a Core admin API. Add a service method:

```ts
// apps/backend/src/services/authUserMobile.service.ts
import supertokens from 'supertokens-node';

async deleteSupertokensUser(userId: string): Promise<void> {
  await supertokens.deleteUser(userId);
}
```

---

## Phase 2 — Mobile: Replace Passwordless / OTP Flow (Day 2, ~4 hours)

This replaces all of `passwordlessAuth.ts` — the most complex change.

### 2.1 How the new OTP flow maps to current UX

| Current (Cognito/Amplify)                                               | New (SuperTokens)                                              |
| ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| `signUp({ username, password })`                                        | Not needed — SuperTokens creates user on first `createCode`    |
| `signIn({ username, options: { authFlowType: 'CUSTOM_WITHOUT_SRP' } })` | `POST /v1/auth/signinup/code` — creates and sends OTP          |
| `confirmSignIn({ challengeResponse: otp })`                             | `POST /v1/auth/signinup/code/consume` — verifies OTP           |
| `fetchAuthSession()`                                                    | `SuperTokens.getAccessToken()` from `supertokens-react-native` |
| `signOut({ global: true })`                                             | `SuperTokens.signOut()`                                        |

### 2.2 Rewrite `passwordlessAuth.ts`

```ts
// apps/mobileAppYC/src/features/auth/services/passwordlessAuth.ts
import SuperTokens from 'supertokens-react-native';
import type { ProfileStatus } from '@/features/account/services/profileService';
import { syncAuthUser } from '@/features/auth/services/authUserService';
import { AUTH_FEATURE_FLAGS, DEMO_LOGIN_CONFIG } from '@/config/variables';

export const DEMO_LOGIN_EMAIL = (DEMO_LOGIN_CONFIG.email ?? '').trim().toLowerCase();

export type PasswordlessSignInRequestResult = {
  destination: string;
  isNewUser: boolean; // SuperTokens returns this in the consume response
  isDemoLogin: boolean;
};

export type PasswordlessSignInCompletion = {
  userId: string;
  email: string;
  tokens: {
    accessToken: string;
    expiresAt?: number;
    userId: string;
    provider: 'supertokens';
  };
  profile: ProfileStatus;
  parentLinked: boolean;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

// Step 1: Send OTP email
export const requestPasswordlessEmailCode = async (
  email: string
): Promise<PasswordlessSignInRequestResult> => {
  const username = normalizeEmail(email);
  const isDemoLogin =
    AUTH_FEATURE_FLAGS.enableReviewLogin === true &&
    DEMO_LOGIN_EMAIL.length > 0 &&
    username === DEMO_LOGIN_EMAIL;

  const response = await fetch(`${process.env.API_BASE_URL}/v1/auth/signinup/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: username }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(parsePasswordlessError(err));
  }

  return {
    destination: username,
    isNewUser: false, // unknown until code consumed — SuperTokens returns it then
    isDemoLogin,
  };
};

// Step 2: Verify OTP and establish session
export const completePasswordlessSignIn = async (
  otpCode: string,
  email: string
): Promise<PasswordlessSignInCompletion> => {
  const response = await fetch(`${process.env.API_BASE_URL}/v1/auth/signinup/code/consume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userInputCode: otpCode, email: normalizeEmail(email) }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.status !== 'OK') {
    throw new Error(parsePasswordlessError(data));
  }

  // supertokens-react-native handles cookie/token storage automatically
  // after the response headers are processed. For RN we store manually:
  const accessToken: string = data.session?.accessToken ?? '';
  const userId: string = data.user?.id ?? '';
  const userEmail: string = data.user?.emails?.[0] ?? email;
  const expiresAt: number | undefined = data.session?.accessTokenPayload?.exp
    ? data.session.accessTokenPayload.exp * 1000
    : undefined;

  let authSync: Awaited<ReturnType<typeof syncAuthUser>> | undefined;
  try {
    authSync = await syncAuthUser({ authToken: accessToken, idToken: accessToken });
  } catch (error) {
    console.warn('[Auth] Failed to sync auth user during OTP flow', error);
  }

  const normalizedProfile: ProfileStatus = authSync?.parentSummary
    ? {
        exists: true,
        isComplete: Boolean(authSync.parentSummary.isComplete),
        profileToken: authSync.parentSummary.profileImageUrl,
        source: 'remote',
        parent: authSync.parentSummary,
      }
    : { exists: false, isComplete: false, profileToken: undefined, source: 'remote' };

  return {
    userId,
    email: userEmail,
    tokens: {
      accessToken,
      expiresAt,
      userId,
      provider: 'supertokens',
    },
    profile: normalizedProfile,
    parentLinked: authSync?.parentLinked ?? false,
  };
};

export const signOutEverywhere = async () => {
  try {
    await SuperTokens.signOut();
    console.log('[SuperTokens] Signed out');
  } catch (error) {
    console.warn('[SuperTokens] Sign out failed:', error);
  }
};

const parsePasswordlessError = (error: unknown): string => {
  const data = typeof error === 'object' && error ? (error as Record<string, unknown>) : {};
  const status = data.status as string | undefined;
  const message = data.message as string | undefined;

  if (status === 'INCORRECT_USER_INPUT_CODE_ERROR')
    return 'The code you entered is incorrect. Please try again.';
  if (status === 'EXPIRED_USER_INPUT_CODE_ERROR')
    return 'The code has expired. Request a new one to continue.';
  if (status === 'RESTART_FLOW_ERROR')
    return 'Too many failed attempts. Please request a new code.';
  if (message?.toLowerCase().includes('expired'))
    return 'The code has expired. Request a new one to continue.';

  return message ?? 'Unexpected authentication error. Please retry.';
};

export const formatAuthError = (error: unknown) => parsePasswordlessError(error);
```

---

## Phase 3 — Mobile: Replace Social Auth (Day 2, ~3 hours)

### How the social flow changes

The native SDKs (Google Sign-In, Apple Auth, Facebook SDK) stay exactly as they are.  
Only the **final step** changes: instead of calling Firebase `signInWithCredential()`, you call the SuperTokens `/signinup` endpoint with the OAuth token.

SuperTokens supports the **OAuth/Access Token flow** for mobile — you send the token you already have and SuperTokens fetches the user profile and creates the session.

### 3.1 Rewrite the token-exchange step in `socialAuth.ts`

Find the `signInWithSocialProvider` function. The part that changes is after `resolveCredential()` returns.

**Current flow:**

```ts
// Gets native token
const { userCredential } = await resolveCredential(provider);
// Signs into Firebase
const firebaseUser = userCredential.user;
const idToken = await getIdToken(firebaseUser);
// Then calls syncAuthUser with Firebase token
```

**New flow:**

```ts
// Gets native token — UNCHANGED
const nativeTokens = await resolveNativeToken(provider); // see below

// Instead of Firebase: call SuperTokens signinup
const response = await fetch(`${process.env.API_BASE_URL}/v1/auth/signinup`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    thirdPartyId: provider, // 'google' | 'apple' | 'facebook'
    oAuthTokens: {
      access_token: nativeTokens.accessToken,
      id_token: nativeTokens.idToken, // send both if available
    },
  }),
});

const data = await response.json();
if (data.status !== 'OK') throw new Error(data.message ?? 'Social sign-in failed');

const accessToken = data.session?.accessToken;
const userId = data.user?.id;
```

### 3.2 Extract native token acquisition (no Firebase)

Replace `resolveCredential()` with `resolveNativeToken()` that returns raw tokens without touching Firebase:

```ts
type NativeTokenResult = {
  accessToken?: string;
  idToken?: string;
  authCode?: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

const resolveNativeToken = async (provider: SocialProvider): Promise<NativeTokenResult> => {
  switch (provider) {
    case 'google': {
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signOut().catch(() => {});
      await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();
      // For SuperTokens OAuth token flow: send access_token
      return { accessToken: tokens.accessToken, idToken: tokens.idToken };
    }

    case 'facebook': {
      // iOS limited login gives authentication token, Android gives access token
      // Platform-specific logic stays identical to current socialAuth.ts
      // — just return the token instead of passing to Firebase
      if (Platform.OS === 'ios') {
        const rawNonce = uuid();
        const loginResult = await LoginManager.logInWithPermissions(
          ['public_profile', 'email'],
          'limited',
          rawNonce
        );
        if (loginResult.isCancelled) {
          const e = new Error('Facebook sign-in cancelled');
          (e as any).code = 'auth/cancelled';
          throw e;
        }
        const tokenResult = await AuthenticationToken.getAuthenticationTokenIOS();
        return { accessToken: tokenResult?.authenticationToken };
      }
      const loginResult = await LoginManager.logInWithPermissions(['public_profile', 'email']);
      if (loginResult.isCancelled) {
        const e = new Error('Facebook sign-in cancelled');
        (e as any).code = 'auth/cancelled';
        throw e;
      }
      const currentAccessToken = await AccessToken.getCurrentAccessToken();
      return { accessToken: currentAccessToken?.accessToken };
    }

    case 'apple': {
      // iOS
      if (Platform.OS === 'ios') {
        const result = await appleAuth.performRequest({
          requestedOperation: appleAuth.Operation.LOGIN,
          requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
        });
        // For SuperTokens: use Authorization Code flow for Apple (not access token)
        // Send authorizationCode + idToken via redirectURIInfo
        return {
          idToken: result.identityToken ?? undefined,
          authCode: result.authorizationCode ?? undefined,
          email: result.email,
          firstName: result.fullName?.givenName,
          lastName: result.fullName?.familyName,
        };
      }
      // Android — appleAuthAndroid.signIn() stays the same
      // return { idToken: response.id_token }
    }
  }
};
```

> **Apple note:** Apple requires the **Authorization Code** flow on the backend (not just an access token). SuperTokens handles this if you send `redirectURIInfo.redirectURIQueryParams.code` instead of `oAuthTokens`. See the SuperTokens docs example for Apple mobile above.

---

## Phase 4 — Mobile: Update Session Manager (Day 3, ~3 hours)

### 4.1 What changes in `sessionManager.ts`

| Current                                                                  | New                                    |
| ------------------------------------------------------------------------ | -------------------------------------- |
| `attemptAmplifyRecovery()` — calls `fetchAuthSession()` from aws-amplify | Remove entirely                        |
| `attemptFirebaseRecovery()` — calls `getIdToken(firebaseUser)`           | Remove entirely                        |
| `getFreshStoredTokens()` — refreshes via Amplify or Firebase             | Replace with SuperTokens token refresh |
| `scheduleSessionRefresh()`                                               | Keep as-is — still valid               |
| `registerAppStateListener()`                                             | Keep as-is                             |
| `recoverFromStoredTokens()`                                              | Keep as-is — reads from Keychain       |

### 4.2 New `getFreshStoredTokens` using SuperTokens

```ts
// In sessionManager.ts — replace the Amplify/Firebase refresh blocks
import SuperTokens from 'supertokens-react-native';

export const getFreshStoredTokens = async (): Promise<NormalizedAuthTokens | null> => {
  const storedTokens = await loadStoredTokens();
  if (!storedTokens) return null;

  const normalized = normalizeTokens(
    { ...storedTokens, userId: storedTokens.userId ?? '', provider: 'supertokens' },
    storedTokens.userId ?? ''
  );

  if (!isTokenExpired(normalized.expiresAt)) {
    return normalized;
  }

  try {
    // SuperTokens RN SDK handles refresh automatically when you call getAccessToken
    const newAccessToken = await SuperTokens.getAccessToken();
    if (!newAccessToken) return null;

    const refreshed: StoredAuthTokens = {
      ...storedTokens,
      accessToken: newAccessToken,
      idToken: newAccessToken,
      provider: 'supertokens',
    };

    await storeTokens(refreshed);
    markAuthRefreshed();
    return normalizeTokens(refreshed, storedTokens.userId ?? '', 'supertokens');
  } catch (error) {
    console.warn('[Auth] Unable to refresh SuperTokens session', error);
    return null;
  }
};
```

### 4.3 Update `recoverAuthSession`

Remove the `attemptAmplifyRecovery` and `attemptFirebaseRecovery` calls. The flow becomes:

```ts
export const recoverAuthSession = async (): Promise<RecoverAuthOutcome> => {
  const existingUserRaw = await AsyncStorage.getItem(USER_KEY);
  const existingUser = existingUserRaw ? (JSON.parse(existingUserRaw) as User) : null;

  // Only path: check stored tokens (SuperTokens access token in Keychain)
  const storedTokensResult = await recoverFromStoredTokens(
    existingUser,
    existingUser?.profileToken
  );
  if (storedTokensResult) {
    // ... existing pending profile logic stays unchanged ...
    return storedTokensResult;
  }

  await clearSessionData();
  return { kind: 'unauthenticated' };
};
```

### 4.4 Update `AuthProviderName` type

```ts
// apps/mobileAppYC/src/features/auth/services/tokenStorage.ts
// Before:
export type AuthProviderName = 'amplify' | 'firebase';

// After (keep old values during transition, add supertokens):
export type AuthProviderName = 'amplify' | 'firebase' | 'supertokens';
```

Once all users have migrated, remove `'amplify'` and `'firebase'`.

---

## Phase 5 — Mobile: Account Deletion + Logout (Day 3, ~1 hour)

### 5.1 Rewrite `accountDeletion.ts`

```ts
// apps/mobileAppYC/src/features/auth/services/accountDeletion.ts
import SuperTokens from 'supertokens-react-native';

export const deleteSupertokensAccount = async (accessToken: string): Promise<void> => {
  // Call your backend endpoint which calls supertokens.deleteUser(userId)
  const response = await fetch(`${process.env.API_BASE_URL}/v1/user/delete-account`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Unable to delete account.');
  }

  await SuperTokens.signOut();
};
```

### 5.2 Update `logout` thunk

```ts
// apps/mobileAppYC/src/features/auth/thunks.ts
export const logout = createAsyncThunk('auth/logout', async (_, { dispatch, getState }) => {
  try {
    await signOutEverywhere(); // now calls SuperTokens.signOut()
  } catch (error) {
    console.warn('[Auth] Sign out failed:', error);
  }

  // All the dispatch(reset*) calls stay identical — no change needed
  await clearSessionData({ clearPendingProfile: true });
  resetAuthLifecycle({ clearPendingProfile: true });
  appStateListenerRegistered = false;

  dispatch(resetAuthState());
  // ... rest unchanged
});
```

---

## Phase 6 — Backend: Switch Routes to `authorizeSupertokens` (Day 4, ~2 hours)

### 6.1 Routing strategy during transition

Do **not** do a big-bang switch. Use a compatibility wrapper during the transition period:

```ts
// apps/backend/src/middlewares/auth.ts

/**
 * Accepts BOTH old tokens (Cognito/Firebase) and new SuperTokens tokens.
 * Remove this after all clients are on SuperTokens.
 */
export const authorizeAny = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.slice('Bearer '.length).trim();
  if (!token) return res.status(401).json({ message: 'Authorization header missing' });

  // Try SuperTokens first (new clients)
  try {
    await verifySession()(req as any, res, () => {});
    if ((req as any).session) {
      // SuperTokens verified — enrich req and continue
      const session = (req as any).session;
      (req as AuthenticatedRequest).userId = session.getUserId();
      (req as AuthenticatedRequest).provider = 'supertokens';
      return next();
    }
  } catch {
    /* fall through */
  }

  // Fall back to Cognito/Firebase (old clients during transition)
  return authorizeCognitoMobile(req, res, next);
};
```

Apply `authorizeAny` to all mobile routes instead of `authorizeCognitoMobile` during the transition. Once all app versions in the wild use SuperTokens (track via app version header), switch to `authorizeSupertokens` only.

### 6.2 Web routes (`authorizeCognito`)

Web routes currently use Cognito for the dashboard. These are **not** in scope for this migration — leave `authorizeCognito` on web routes until the web frontend migrates separately.

---

## Phase 7 — Cleanup (After validation, Day 5)

Once SuperTokens is live and validated in production:

1. Remove `aws-amplify/auth` import from `passwordlessAuth.ts` ✓ (done in Phase 2)
2. Remove `@react-native-firebase/auth` import from `socialAuth.ts` and `sessionManager.ts` ✓
3. Remove `firebase-admin` from backend `auth.ts` middleware
4. Uninstall packages:
   ```bash
   pnpm --filter mobileAppYC remove @aws-amplify/react-native aws-amplify @react-native-firebase/auth
   pnpm --filter api remove firebase-admin @aws-sdk/client-cognito-identity-provider
   ```
5. Remove `amplify/` directory from `apps/mobileAppYC/`
6. Remove `amplify_outputs.json` from `apps/mobileAppYC/`
7. Remove `COGNITO_*` env vars from all `.env` files and CI secrets
8. Remove `GOOGLE_APPLICATION_CREDENTIALS` (Firebase service account) env var
9. Update `AuthProviderName` type — remove `'amplify'` and `'firebase'`
10. Update `authProvider` enum in Mongoose model and Prisma schema — remove `cognito` and `firebase`
11. Run Prisma migration for enum cleanup

---

## Environment Variables: Before → After

### Backend

| Remove                           | Add                          |
| -------------------------------- | ---------------------------- |
| `COGNITO_REGION`                 | `SUPERTOKENS_CONNECTION_URI` |
| `COGNITO_USER_POOL_ID`           | `SUPERTOKENS_API_KEY`        |
| `COGNITO_USER_POOL_ID_MOBILE`    | `API_DOMAIN`                 |
| `COGNITO_AUDIENCE`               | `WEB_DOMAIN`                 |
| `GOOGLE_APPLICATION_CREDENTIALS` | `GOOGLE_CLIENT_ID`           |
| `AWS_REGION` (auth only)         | `GOOGLE_CLIENT_SECRET`       |
| —                                | `APPLE_BUNDLE_ID`            |
| —                                | `APPLE_KEY_ID`               |
| —                                | `APPLE_PRIVATE_KEY`          |
| —                                | `APPLE_TEAM_ID`              |
| —                                | `FACEBOOK_APP_ID`            |
| —                                | `FACEBOOK_APP_SECRET`        |

### Mobile

| Remove                                   | Add                             |
| ---------------------------------------- | ------------------------------- |
| Amplify config in `amplify_outputs.json` | `API_BASE_URL` (already exists) |
| All Cognito pool IDs in `variables.ts`   | —                               |

---

## Dependencies: Before → After

### `apps/mobileAppYC/package.json`

| Remove                         | Add                        |
| ------------------------------ | -------------------------- |
| `@aws-amplify/react-native`    | `supertokens-react-native` |
| `@aws-amplify/ui-react-native` | —                          |
| `aws-amplify`                  | —                          |
| `@react-native-firebase/auth`  | —                          |
| `@react-native-firebase/app`   | —                          |
| `amazon-cognito-identity-js`   | —                          |

**Keep** (native social login SDKs — unchanged):

- `@react-native-google-signin/google-signin`
- `@invertase/react-native-apple-authentication`
- `react-native-fbsdk-next`

### `apps/backend/package.json`

| Remove                                      | Add                |
| ------------------------------------------- | ------------------ |
| `firebase-admin`                            | `supertokens-node` |
| `@aws-sdk/client-cognito-identity-provider` | —                  |
| `amazon-cognito-identity-js` (if present)   | —                  |

---

## Testing Checklist

### Mobile — manual smoke tests

- [ ] Email OTP: request code → receive email → enter code → authenticated
- [ ] Email OTP: wrong code → correct error message shown
- [ ] Email OTP: expired code → correct error message shown
- [ ] Google sign-in → authenticated
- [ ] Apple sign-in (iOS) → authenticated, name populated
- [ ] Facebook sign-in → authenticated
- [ ] App backgrounded and foregrounded → session still valid
- [ ] App killed and reopened → session recovered from Keychain
- [ ] Logout → all state cleared, redirected to login
- [ ] Account deletion → user deleted from SuperTokens + DB
- [ ] New user first login → profile creation flow triggered
- [ ] Existing user login → existing profile loaded

### Backend — integration tests

- [ ] `POST /v1/auth/signinup` (ThirdParty) returns `status: OK` with valid tokens
- [ ] `POST /v1/auth/signinup/code` (Passwordless) sends OTP
- [ ] `POST /v1/auth/signinup/code/consume` returns session tokens
- [ ] Protected route with valid SuperTokens token → 200
- [ ] Protected route with expired SuperTokens token → 401
- [ ] Protected route with old Cognito token during transition → 200 (via `authorizeAny`)
- [ ] `DELETE /v1/user/delete-account` removes user from SuperTokens core

---

## Rollback Plan

Because we're using `authorizeAny` middleware during the transition:

1. If issues are found post-deploy, keep `authorizeAny` in place and revert the mobile app to the previous build via app store rollback
2. The old Cognito/Firebase users in the DB remain valid — `authProvider: "cognito" | "firebase"` rows are untouched
3. Do **not** tear down the Cognito user pool until you have confirmed zero active Cognito-authenticated sessions (check CloudWatch → Cognito metrics for `TokenRefreshSuccesses` → 0 for 7 consecutive days)

---

## Migration Order Summary

```
Day 0  Infrastructure   SuperTokens Core running on Railway, env vars set
Day 1  Backend          supertokens-node init, authorizeSupertokens middleware, model + schema updates
Day 2  Mobile OTP       passwordlessAuth.ts rewritten, tested end-to-end
Day 2  Mobile Social    socialAuth.ts updated, Firebase removed from sign-in path
Day 3  Mobile Session   sessionManager.ts updated, tokenStorage type updated, logout thunk updated
Day 4  Backend Routes   Switch mobile routes to authorizeAny (dual-verify period begins)
Day 5  QA + Cleanup     Smoke tests pass → remove Amplify/Firebase packages, remove old middleware
```
