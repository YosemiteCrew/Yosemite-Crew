import type { AuthProviderName, AuthSession, RequestContext } from './types.js';

// The contract every auth provider adapter implements. Keep this surface small;
// optional capabilities (login URLs, OAuth callbacks) can be added later as an
// extended interface without changing product code.
export interface AuthProvider {
  readonly name: AuthProviderName;

  getSession(ctx: RequestContext): Promise<AuthSession | null>;

  requireSession(ctx: RequestContext): Promise<AuthSession>;

  signOut(ctx: RequestContext): Promise<void>;
}
