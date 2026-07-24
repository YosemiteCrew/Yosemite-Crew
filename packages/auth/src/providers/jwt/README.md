# JWT auth provider (placeholder)

Not implemented in v1. To add it later, implement `AuthProvider` here as
`JwtAuthProvider` (verify a bearer JWT against a configured JWKS/secret),
normalize claims into `AuthSession`, wire a `case "jwt"` into
`create-auth-provider.ts`, and reuse the same identity mapping.
