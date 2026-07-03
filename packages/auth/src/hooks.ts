import type { AuthHooks } from './types.js';

// Host-injected hooks (see AuthHooks in types.ts). Registered once at init
// time by the host app; consumed by the provider configuration when stamping
// session claims, computing MFA policy, and reporting new users.

let hooks: AuthHooks = {};

export function setAuthHooks(next: AuthHooks): void {
  hooks = next ?? {};
}

export function getAuthHooks(): AuthHooks {
  return hooks;
}
