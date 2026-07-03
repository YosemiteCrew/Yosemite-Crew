# legacy-cognito (grace verifier)

Time-boxed verifier that accepts bearer tokens from the previous auth
providers during the cutover grace window, using pure JWKS verification (no
legacy SDKs). It is only consulted when `AUTH_LEGACY_TOKEN_GRACE=true` and a
request carries no SuperTokens session.

This is **not** an `AuthProvider` implementation - it cannot create sessions,
only validate residual tokens so in-flight sessions and not-yet-updated mobile
builds keep working immediately after cutover.

Removal plan: once the grace window closes (legacy token TTLs elapsed and
mobile fleet updated), delete this directory, the `AUTH_LEGACY_TOKEN_GRACE`
flag, and the legacy env variable names it reads.
