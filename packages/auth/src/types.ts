// Provider-neutral auth types. Product code depends on these, never on a
// specific provider SDK. See providers/<name> for provider-specific adapters.

export type AuthProviderName =
  | 'supertokens'
  | 'oidc'
  | 'jwt'
  | 'proxy'
  | 'dev'
  // Legacy providers, produced only by the time-boxed grace verifier during
  // cutover (providers/legacy-cognito). Never selectable via AUTH_PROVIDER.
  | 'cognito'
  | 'firebase';

export type AuthProfile = 'pims_web' | 'pet_parent_mobile';

export type LoginMethod =
  | 'emailpassword'
  | 'otp-email'
  | 'thirdparty-google'
  | 'thirdparty-apple'
  | 'thirdparty-facebook'
  | 'webauthn'
  | 'totp'
  | 'unknown';

export type AuthMfaState = {
  required: boolean;
  completed: boolean;
  completedFactors: string[];
};

// The normalized session every provider adapter must produce. appUserId is the
// stable internal application user id; provider-specific ids live only in
// providerUserId and the identity mapping table.
export type AuthSession = {
  appUserId: string;

  provider: AuthProviderName;
  authProfile?: AuthProfile;

  providerUserId: string;
  loginMethod?: LoginMethod;

  email?: string;
  emailVerified?: boolean;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;

  roles: string[];
  permissions: string[];
  claims: Record<string, unknown>;

  mfa?: AuthMfaState;
};

// Framework-agnostic request handle. The SuperTokens adapter narrows this to
// Express req/res internally; other adapters can narrow differently.
export type RequestContext = {
  req: unknown;
  res?: unknown;
};

// Hooks the host application injects at init time. They let the auth package
// consult application data (which lives behind Prisma in the backend) without
// the package depending on the database, and let the application react to
// provider events without importing a provider SDK.
export type AuthHooks = {
  // Decide which product profile a user belongs to (e.g. staff record exists →
  // "pims_web"). Called at session creation and when computing MFA policy.
  // Returning undefined falls back to the login-method default.
  resolveAuthProfile?: (input: {
    appUserId: string;
    email?: string;
    loginMethod: LoginMethod;
  }) => Promise<AuthProfile | undefined>;

  // Fired after the provider creates a brand-new user (sign-up). The host
  // records the identity mapping (auth_identities) here.
  onUserCreated?: (input: {
    appUserId: string;
    providerUserId: string;
    provider: AuthProviderName;
    authProfile: AuthProfile;
    email?: string;
    loginMethod: LoginMethod;
  }) => Promise<void>;
};
