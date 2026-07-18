# "Continue with GitHub" for developers

Developers can sign in / sign up with GitHub. This is a **SuperTokens ThirdParty
(GitHub)** flow: the browser never holds a client secret, the backend GitHub
provider performs the token exchange, and the "Continue with GitHub" button stays
hidden until it is enabled, so nothing ships half-wired.

## How it works

1. The developer clicks **Continue with GitHub** on `/signin` (or `/signup`). The
   app calls SuperTokens `getAuthorisationURLWithQueryParamsAndSetState({ thirdPartyId: 'github', frontendRedirectURI: '<origin>/auth/callback' })`,
   which builds the GitHub authorisation URL (PKCE + CSRF state handled by the SDK)
   and navigates the browser to GitHub.
2. GitHub runs the OAuth handshake and redirects back to `/auth/callback` with a
   `code` and `state`.
3. `/auth/callback` calls SuperTokens `signInAndUp()`, which posts the `code`/`state`
   to the backend; the backend GitHub provider exchanges them (using the client
   secret it holds), creates or signs in the user, and establishes the session.
4. The callback forwards the developer to the stored return path (default
   `/developers/home`).

Relevant code: `src/app/features/auth/lib/githubOAuth.ts`,
`src/app/features/auth/pages/GithubSignInButton.tsx`,
`src/app/features/auth/pages/AuthCallback/AuthCallback.tsx`, and the backend
provider in `packages/auth/src/config/supertokens.config.ts` (`buildThirdPartyProviders`).

## Env vars

| Variable                          | Where    | Example    | Notes                                                                |
| --------------------------------- | -------- | ---------- | -------------------------------------------------------------------- |
| `NEXT_PUBLIC_AUTH_GITHUB_ENABLED` | frontend | `true`     | Enables the button. Must be `true`, else the button renders nothing. |
| `AUTH_GITHUB_CLIENT_ID`           | backend  | `Iv1.xxxx` | GitHub OAuth App client id. Registers the backend GitHub provider.   |
| `AUTH_GITHUB_CLIENT_SECRET`       | backend  | `xxxxxxxx` | GitHub OAuth App client secret. Never exposed to the browser.        |

Both sides are gated independently: the backend provider only registers when
`AUTH_GITHUB_CLIENT_ID` is set, and the button only appears when
`NEXT_PUBLIC_AUTH_GITHUB_ENABLED=true`. Set all three together.

## One-time infra setup

SuperTokens ships a built-in GitHub provider, so no OIDC bridge is needed.

1. **GitHub OAuth App** (Settings -> Developer settings -> OAuth Apps -> New):
   - Homepage URL: your app origin.
   - Authorization callback URL: `https://<your-app-domain>/auth/callback`
     (and `http://localhost:3000/auth/callback` for local dev).
   - Note the Client ID and generate a Client Secret.
2. **Backend env**: set `AUTH_GITHUB_CLIENT_ID` and `AUTH_GITHUB_CLIENT_SECRET` for
   the API service. This registers the `github` third-party provider (see
   `buildThirdPartyProviders`).
3. **Frontend env**: set `NEXT_PUBLIC_AUTH_GITHUB_ENABLED=true`.
4. **Role treatment**: GitHub users get the same role handling as the other
   third-party providers (Google/Apple/Facebook). Roles are stored in SuperTokens
   UserMetadata (`packages/auth/src/providers/supertokens/supertokens-provider.ts`);
   if developers signing in via GitHub should be tagged `developer`, apply it through
   the same third-party sign-up path as the other providers rather than anything
   GitHub-specific.

## CSP

No change is needed. The `/authorize` step is a top-level navigation to GitHub, and
the `signInAndUp` token exchange is a same-origin call to the app's auth API (already
allowed by `connect-src 'self'` + the API domain in `src/securityHeaders.ts`).

## Local testing

Set `NEXT_PUBLIC_AUTH_GITHUB_ENABLED=true` in `.env.local`, set
`AUTH_GITHUB_CLIENT_ID` / `AUTH_GITHUB_CLIENT_SECRET` for the local API, register
`http://localhost:3000/auth/callback` as the GitHub OAuth App callback URL, then run
the app and click **Continue with GitHub**.
