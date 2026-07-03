import type { AuthProfile, AuthProviderName } from './types.js';
import { AuthConfigError } from './errors.js';

export type SuperTokensConfig = {
  connectionUri: string;
  apiKey?: string;
  appName: string;
  apiDomain: string;
  websiteDomain: string;
  apiBasePath: string;
  websiteBasePath: string;
};

export type AuthConfig = {
  provider: AuthProviderName;
  profile?: AuthProfile;
  supertokens?: SuperTokensConfig;
};

const PROVIDERS: readonly AuthProviderName[] = ['supertokens', 'oidc', 'jwt', 'proxy', 'dev'];

const PROFILES: readonly AuthProfile[] = ['pims_web', 'pet_parent_mobile'];

// Read provider-neutral auth config from the environment. Provider selection is
// deployment-time (AUTH_PROVIDER); per-product login behavior is AUTH_PROFILE.
// SuperTokens specifics fall back to the existing AUTH_*/SUPERTOKENS_* vars so
// this layer can be introduced without changing deployment config.
export function readAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const provider = (env.AUTH_PROVIDER ?? 'supertokens') as AuthProviderName;
  const profile = env.AUTH_PROFILE as AuthProfile | undefined;

  const config: AuthConfig = { provider, profile };

  if (provider === 'supertokens') {
    config.supertokens = {
      connectionUri: env.SUPERTOKENS_CONNECTION_URI ?? '',
      apiKey: env.SUPERTOKENS_API_KEY,
      appName: env.SUPERTOKENS_APP_NAME ?? env.AUTH_APP_NAME ?? 'Yosemite Crew',
      apiDomain: env.SUPERTOKENS_API_DOMAIN ?? env.AUTH_API_DOMAIN ?? '',
      websiteDomain: env.SUPERTOKENS_WEBSITE_DOMAIN ?? env.AUTH_WEBSITE_DOMAIN ?? '',
      apiBasePath: env.SUPERTOKENS_API_BASE_PATH ?? env.AUTH_API_BASE_PATH ?? '/auth',
      websiteBasePath: env.SUPERTOKENS_WEBSITE_BASE_PATH ?? env.AUTH_WEBSITE_BASE_PATH ?? '/auth',
    };
  }

  return config;
}

// Fail fast at startup on invalid auth config rather than letting broken auth
// surface at runtime.
export function validateAuthConfig(config: AuthConfig): void {
  if (!config.provider) {
    throw new AuthConfigError('AUTH_PROVIDER is required.');
  }

  if (!PROVIDERS.includes(config.provider)) {
    throw new AuthConfigError(
      `Unsupported AUTH_PROVIDER: ${config.provider}. Supported: ${PROVIDERS.join(', ')}.`
    );
  }

  if (config.profile && !PROFILES.includes(config.profile)) {
    throw new AuthConfigError(
      `Unsupported AUTH_PROFILE: ${config.profile}. Supported: ${PROFILES.join(', ')}.`
    );
  }

  if (config.provider === 'supertokens') {
    const st = config.supertokens;
    if (!st?.connectionUri) {
      throw new AuthConfigError('AUTH_PROVIDER=supertokens requires SUPERTOKENS_CONNECTION_URI.');
    }
    if (!st.apiDomain) {
      throw new AuthConfigError(
        'AUTH_PROVIDER=supertokens requires an API domain (SUPERTOKENS_API_DOMAIN or AUTH_API_DOMAIN).'
      );
    }
    if (!st.websiteDomain) {
      throw new AuthConfigError(
        'AUTH_PROVIDER=supertokens requires a website domain (SUPERTOKENS_WEBSITE_DOMAIN or AUTH_WEBSITE_DOMAIN).'
      );
    }
  }
}
