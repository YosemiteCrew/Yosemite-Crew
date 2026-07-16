# OIDC auth provider (placeholder)

Not implemented in v1. To add it later, implement `AuthProvider` here as
`OidcAuthProvider`, wire a `case "oidc"` into `create-auth-provider.ts`, verify
the ID token via issuer/JWKS, normalize claims into `AuthSession`, and reuse the
same `users` / `auth_identities` mapping. No product code should need to change.
