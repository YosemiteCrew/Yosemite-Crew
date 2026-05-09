import type {MobileConfig} from '@/shared/services/mobileConfig';

export type AppRuntimeEnv = 'production' | 'development';
export type MockAppUpdateFlow = 'off' | 'optional' | 'required';

export const PRODUCTION_API_BASE_URL = 'https://api.yosemitecrew.com';
export const DEVELOPMENT_API_BASE_URL = 'https://devapi.yosemitecrew.com';
export const MOBILE_CONFIG_PATH = '/v1/mobile-config/';

export interface EnvironmentConfig {
  /**
   * Single switch for selecting the default backend environment.
   * `production` -> production API + production mobile-config endpoint
   * `development` -> development API + development mobile-config endpoint
   */
  appEnv: AppRuntimeEnv;
}

export interface PasswordlessAuthConfig {
  profileServiceUrl: string;
  createAccountUrl: string;
  profileBootstrapUrl: string;
  googleWebClientId: string;
  facebookAppId: string;
  appleServiceId: string;
  appleRedirectUri: string;
}

export interface GooglePlacesConfig {
  apiKey: string;
}

export interface ApiConfig {
  baseUrl: string;
  timeoutMs: number;
  /**
   * Optional secondary base for PMS endpoints if they live on a different host.
   * Falls back to `baseUrl` when omitted.
   */
  pmsBaseUrl?: string;
}

export interface StreamChatConfig {
  apiKey: string;
}

export interface StripeConfig {
  publishableKey: string;
  merchantIdentifier?: string;
  merchantDisplayName?: string;
  urlScheme?: string;
}

export interface AuthFeatureFlags {
  enableReviewLogin: boolean;
}

export interface DemoLoginConfig {
  email?: string;
  password?: string;
}

export interface UiFeatureFlags {
  /**
   * Forces a 1px black outline on all liquid glass surfaces (cards/buttons).
   */
  forceLiquidGlassBorder: boolean;
}

export interface RuntimeConfigOverrides {
  /**
   * Explicit local override for review/demo login.
   * `undefined` means "follow remote mobile-config/defaults".
   */
  enableReviewLogin?: boolean;
  /**
   * Explicit local override for the resolved API base URL.
   */
  apiBaseUrl?: string;
  /**
   * Explicit local override for PMS endpoints.
   */
  pmsBaseUrl?: string;
  /**
   * Explicit local override for which mobile-config URL is fetched.
   */
  mobileConfigUrl?: string;
  /**
   * Explicit local override for the resolved Stripe publishable key.
   */
  stripePublishableKey?: string;
  /**
   * Explicit local override for the resolved UI glass-border flag.
   */
  forceLiquidGlassBorder?: boolean;
  /**
   * Optional payload layered on top of the fetched mobile-config response.
   */
  mobileConfig?: Partial<MobileConfig>;
}

export interface MobileConfigBehavior {
  /**
   * When true, skip hitting the remote mobile-config endpoint entirely.
   * The app starts with the default hard-coded config (production env, payments off).
   * Use this when you want fully offline local dev without any network call.
   */
  skipRemoteFetch: boolean;
  /**
   * Master switch to route ALL API calls to the dev backend.
   * true  → https://devapi.yosemitecrew.com  (dev environment)
   * false → https://api.yosemitecrew.com     (production — the default)
   *
   * This controls where the mobile-config is fetched FROM and where subsequent
   * API calls land. Use `overrides.apiBaseUrl` for a one-off URL override instead.
   */
  useDevApi: boolean;
  /**
   * Local-only helper to simulate app update prompts without backend changes.
   * 'off'      → normal behaviour
   * 'optional' → show optional update sheet
   * 'required' → show forced update wall
   */
  mockAppUpdateFlow: MockAppUpdateFlow;
  /**
   * Fine-grained local overrides applied after the remote config is fetched.
   * Any key set here wins over both remote config and appEnv defaults.
   */
  overrides: RuntimeConfigOverrides;
}

export interface PostHogConfig {
  apiKey: string;
  captureScreens: boolean;
  defaultOptIn: boolean;
  enableSessionReplay: boolean;
  enabled: boolean;
  host: string;
}

type LocalVariablesModule = Partial<{
  ENVIRONMENT_CONFIG: Partial<EnvironmentConfig>;
  PASSWORDLESS_AUTH_CONFIG: Partial<PasswordlessAuthConfig>;
  GOOGLE_PLACES_CONFIG: Partial<GooglePlacesConfig>;
  API_CONFIG: Partial<ApiConfig>;
  STREAM_CHAT_CONFIG: Partial<StreamChatConfig>;
  STRIPE_CONFIG: Partial<StripeConfig>;
  AUTH_FEATURE_FLAGS: Partial<AuthFeatureFlags>;
  DEMO_LOGIN_CONFIG: Partial<DemoLoginConfig>;
  UI_FEATURE_FLAGS: Partial<UiFeatureFlags>;
  MOBILE_CONFIG_BEHAVIOR: Partial<MobileConfigBehavior>;
  POSTHOG_CONFIG: Partial<PostHogConfig>;
}>;

export const resolveApiBaseUrlForAppEnv = (appEnv: AppRuntimeEnv): string =>
  appEnv === 'production' ? PRODUCTION_API_BASE_URL : DEVELOPMENT_API_BASE_URL;

export const resolveMobileConfigUrlForAppEnv = (
  appEnv: AppRuntimeEnv,
): string => `${resolveApiBaseUrlForAppEnv(appEnv)}${MOBILE_CONFIG_PATH}`;

const DEFAULT_ENVIRONMENT_CONFIG: EnvironmentConfig = {
  appEnv: 'production',
};

const DEFAULT_PASSWORDLESS_AUTH_CONFIG: PasswordlessAuthConfig = {
  profileServiceUrl: '',
  createAccountUrl: '',
  profileBootstrapUrl: '',
  googleWebClientId: '',
  facebookAppId: '',
  appleServiceId: 'com.yourAppName.mobile.auth',
  appleRedirectUri: 'https://yourDomain.firebaseapp.com/__/auth/handler',
};

const DEFAULT_GOOGLE_PLACES_CONFIG: GooglePlacesConfig = {
  apiKey: '',
};

const DEFAULT_STREAM_CHAT_CONFIG: StreamChatConfig = {
  apiKey: '',
};

const DEFAULT_STRIPE_CONFIG: StripeConfig = {
  publishableKey: '',
  merchantIdentifier: undefined,
  merchantDisplayName: undefined,
  urlScheme: 'yosemitecrew',
};

const DEFAULT_AUTH_FEATURE_FLAGS: AuthFeatureFlags = {
  enableReviewLogin: true,
};

const DEFAULT_DEMO_LOGIN_CONFIG: DemoLoginConfig = {
  email: '',
  password: '',
};

const DEFAULT_UI_FEATURE_FLAGS: UiFeatureFlags = {
  forceLiquidGlassBorder: false,
};

const DEFAULT_MOBILE_CONFIG_BEHAVIOR: MobileConfigBehavior = {
  skipRemoteFetch: false,
  useDevApi: false,
  mockAppUpdateFlow: 'off',
  overrides: {},
};

const DEFAULT_POSTHOG_CONFIG: PostHogConfig = {
  apiKey: '',
  captureScreens: true,
  defaultOptIn: false,
  enableSessionReplay: false,
  enabled: false,
  host: 'https://us.i.posthog.com',
};

const isMissingLocalVariablesModule = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as Partial<NodeJS.ErrnoException> & {
    message?: string;
  };
  if (candidate.code !== 'MODULE_NOT_FOUND') {
    return false;
  }

  return (
    typeof candidate.message === 'string' &&
    candidate.message.includes('variables.local')
  );
};

const loadLocalVariablesModule = (): LocalVariablesModule => {
  try {
    // @ts-ignore - optional local developer config
    return require('./variables.local') as LocalVariablesModule;
  } catch (error) {
    if (isMissingLocalVariablesModule(error)) {
      if (process.env.NODE_ENV !== 'test' && process.env.CI !== 'true') {
        console.warn(
          'No variables.local.ts found. Using default configuration. ' +
            'For local development, copy variables.ts to variables.local.ts and add your credentials.',
        );
      }
      return {};
    }

    throw error;
  }
};

const mergeMobileConfigBehavior = (
  overrides: Partial<MobileConfigBehavior> | undefined,
): MobileConfigBehavior => ({
  ...DEFAULT_MOBILE_CONFIG_BEHAVIOR,
  ...overrides,
  overrides: {
    ...DEFAULT_MOBILE_CONFIG_BEHAVIOR.overrides,
    ...(overrides?.overrides ?? {}),
  },
});

const localVariables = loadLocalVariablesModule();

export const ENVIRONMENT_CONFIG: EnvironmentConfig = {
  ...DEFAULT_ENVIRONMENT_CONFIG,
  ...localVariables.ENVIRONMENT_CONFIG,
};

const DEFAULT_API_CONFIG: ApiConfig = {
  baseUrl: resolveApiBaseUrlForAppEnv(ENVIRONMENT_CONFIG.appEnv),
  timeoutMs: 15000,
  pmsBaseUrl: resolveApiBaseUrlForAppEnv(ENVIRONMENT_CONFIG.appEnv),
};

export const PASSWORDLESS_AUTH_CONFIG: PasswordlessAuthConfig = {
  ...DEFAULT_PASSWORDLESS_AUTH_CONFIG,
  ...localVariables.PASSWORDLESS_AUTH_CONFIG,
};

export const GOOGLE_PLACES_CONFIG: GooglePlacesConfig = {
  ...DEFAULT_GOOGLE_PLACES_CONFIG,
  ...localVariables.GOOGLE_PLACES_CONFIG,
};

export const API_CONFIG: ApiConfig = {
  ...DEFAULT_API_CONFIG,
  ...localVariables.API_CONFIG,
};

export const STREAM_CHAT_CONFIG: StreamChatConfig = {
  ...DEFAULT_STREAM_CHAT_CONFIG,
  ...localVariables.STREAM_CHAT_CONFIG,
};

export const STRIPE_CONFIG: StripeConfig = {
  ...DEFAULT_STRIPE_CONFIG,
  ...localVariables.STRIPE_CONFIG,
};

export const AUTH_FEATURE_FLAGS: AuthFeatureFlags = {
  ...DEFAULT_AUTH_FEATURE_FLAGS,
  ...localVariables.AUTH_FEATURE_FLAGS,
};

export const DEMO_LOGIN_CONFIG: DemoLoginConfig = {
  ...DEFAULT_DEMO_LOGIN_CONFIG,
  ...localVariables.DEMO_LOGIN_CONFIG,
};

export const UI_FEATURE_FLAGS: UiFeatureFlags = {
  ...DEFAULT_UI_FEATURE_FLAGS,
  ...localVariables.UI_FEATURE_FLAGS,
};

export const MOBILE_CONFIG_BEHAVIOR: MobileConfigBehavior =
  mergeMobileConfigBehavior(localVariables.MOBILE_CONFIG_BEHAVIOR);

export const POSTHOG_CONFIG: PostHogConfig = {
  ...DEFAULT_POSTHOG_CONFIG,
  ...localVariables.POSTHOG_CONFIG,
};

export const PENDING_PROFILE_STORAGE_KEY = '@pending_profile_payload';
export const PENDING_PROFILE_UPDATED_EVENT = 'pendingProfileUpdated';
