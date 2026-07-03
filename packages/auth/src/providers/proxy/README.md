# Proxy auth provider (placeholder)

Not implemented in v1. To add it later, implement `AuthProvider` here as
`ProxyAuthProvider` (trust a fronting auth proxy's signed headers), normalize
into `AuthSession`, wire a `case "proxy"` into `create-auth-provider.ts`, and
reuse the same identity mapping. Only enable behind a trusted network boundary.
