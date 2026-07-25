import type { AuthProvider } from './auth-provider.js';
import type { AuthConfig } from './config.js';
import { validateAuthConfig } from './config.js';
import { AuthConfigError } from './errors.js';
import { SuperTokensAuthProvider } from './providers/supertokens/supertokens-provider.js';

// Deployment-time provider factory. Adding a future provider (oidc/jwt/proxy)
// means adding a case here and an adapter under providers/<name>; product code
// does not change.
export function createAuthProvider(config: AuthConfig): AuthProvider {
  validateAuthConfig(config);

  switch (config.provider) {
    case 'supertokens':
      if (!config.supertokens) {
        throw new AuthConfigError('Missing SuperTokens config.');
      }
      return new SuperTokensAuthProvider();

    default:
      throw new AuthConfigError(
        `Unsupported AUTH_PROVIDER: ${config.provider}. Currently implemented: supertokens.`
      );
  }
}
