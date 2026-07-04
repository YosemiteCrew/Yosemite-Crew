# "Continue with GitHub" for developers

Developers can sign in / sign up with GitHub. The web app implements the frontend
of a **Cognito Hosted UI federation** flow with **PKCE** — the browser never holds
a client secret. The "Continue with GitHub" button stays hidden until the two env
vars below are set, so nothing ships half-wired.

## How it works

1. The developer clicks **Continue with GitHub** on `/signin` (or `/signup` with the
   developer role). The app redirects to the Cognito Hosted UI
   `/oauth2/authorize` endpoint with `identity_provider=<GitHub IdP>` and a PKCE
   `code_challenge`.
2. Cognito runs the GitHub OAuth handshake and redirects back to `/auth/callback`
   with an authorization `code` and the `state` we sent.
3. `/auth/callback` validates `state` (CSRF), exchanges the `code` for tokens at
   `/oauth2/token` using the stored PKCE `code_verifier` (public client, no secret),
   builds a `CognitoUserSession`, and forwards the developer to `/developers/home`.

Relevant code: `src/app/features/auth/lib/githubOAuth.ts`,
`src/app/features/auth/pages/GithubSignInButton.tsx`,
`src/app/features/auth/pages/AuthCallback/AuthCallback.tsx`,
`authStore.establishFederatedSession`.

## Frontend env vars

| Variable                         | Example                                             | Notes                                                                   |
| -------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_COGNITO_CLIENTID`   | `xxxxxxxxxxxx`                                      | Existing app-client id.                                                 |
| `NEXT_PUBLIC_COGNITO_DOMAIN`     | `yosemite-crew.auth.eu-central-1.amazoncognito.com` | Cognito Hosted UI domain (host or full URL). Enables the button.        |
| `NEXT_PUBLIC_COGNITO_GITHUB_IDP` | `GitHub`                                            | Name of the GitHub identity provider in the pool. Defaults to `GitHub`. |

## One-time infra setup

GitHub's OAuth is **not OIDC-compliant** (no discovery / `id_token`), so Cognito
cannot federate GitHub directly. Use a small OIDC bridge, then register that bridge
as a **generic OIDC** identity provider in Cognito.

1. **GitHub OAuth App** (Settings → Developer settings → OAuth Apps):
   - Authorization callback URL: `https://<cognito-domain>/oauth2/idpresponse`.
   - Note the Client ID and generate a Client Secret.
2. **OIDC bridge for GitHub** — deploy an OIDC shim (e.g. the open-source
   `github-cognito-openid-wrapper`) so GitHub exposes `/authorize`, `/token`,
   `/userinfo`, and `/.well-known/jwks.json`. Give it the GitHub client id/secret.
3. **Cognito User Pool → Sign-in experience → Federated identity provider sign-in**:
   add an **OpenID Connect** provider named `GitHub`:
   - Client ID / secret: the GitHub OAuth app's.
   - Issuer URL: the bridge's base URL.
   - Attribute mapping: map `email` → email, `name` → name.
4. **Set the developer role.** Federated users should get `custom:role=developer`
   so `DevRouteGuard`/redirects treat them as developers. Do this with a
   **Pre Token Generation** Lambda (override `custom:role` to `developer` when the
   identity comes from the GitHub provider), or a default value on the mapped attribute.
5. **Cognito User Pool → App integration → your app client**:
   - Enable the `GitHub` identity provider.
   - Allowed callback URLs: add `https://<your-app-domain>/auth/callback`
     (and `http://localhost:3000/auth/callback` for local dev).
   - Allowed sign-out URLs: your app origin.
   - OAuth grant types: **Authorization code grant**.
   - OpenID Connect scopes: `openid`, `email`, `profile`.
6. **Hosted UI domain** — create a domain under App integration → Domain, and use it
   as `NEXT_PUBLIC_COGNITO_DOMAIN`.

## CSP

`connect-src` already allows `https://*.amazoncognito.com` for the `/oauth2/token`
exchange (see `src/securityHeaders.ts`). The `/authorize` step is a top-level
navigation, so no further CSP change is needed.

## Local testing

Set the three env vars in `.env.local`, register `http://localhost:3000/auth/callback`
as an allowed callback URL, then run the app and click **Continue with GitHub**.
