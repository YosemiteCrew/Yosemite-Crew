export { getAuthAppInfo } from './config/appInfo.js';
export { getSuperTokensConfig } from './config/supertokens.config.js';

export { initSuperTokens } from './express/initSuperTokens.js';
export {
  registerSuperTokensBeforeRoutes,
  registerSuperTokensErrorHandler,
} from './express/middleware.js';
export { requireAuth } from './express/requireAuth.js';
export { getSessionUserId } from './express/getSessionUserId.js';

export type { SessionRequest } from 'supertokens-node/framework/express';
export {
  TOTP_FACTOR_ID,
  getRequiredMfaFactorsForUser,
  getSetupMfaFactorsForUser,
  isTotpRequiredForUser,
  isTotpSetupForUser,
  requireTotpForUser,
  removeTotpRequirementForUser,
  getMfaStatusForRequest,
  requireMfaCompleted,
} from './express/mfa.js';

// Provider-neutral auth boundary (product code depends on these, not on a
// specific provider SDK). SuperTokens is the v1 adapter under providers/.
export type {
  AuthProviderName,
  AuthProfile,
  LoginMethod,
  AuthMfaState,
  AuthSession,
  AuthHooks,
  RequestContext,
} from './types.js';
export type { AuthProvider } from './auth-provider.js';
export { AuthService } from './auth-service.js';
export { setAuthService, getAuthService } from './auth-service-registry.js';
export type { AuthConfig, SuperTokensConfig } from './config.js';
export { readAuthConfig, validateAuthConfig } from './config.js';
export { createAuthProvider } from './create-auth-provider.js';
export {
  AuthError,
  AuthRequiredError,
  AuthSessionExpiredError,
  AuthProfileMismatchError,
  AuthConfigError,
} from './errors.js';
export { SuperTokensAuthProvider } from './providers/supertokens/supertokens-provider.js';
export {
  createSessionMiddleware,
  type SessionMiddlewareOptions,
  type SessionRequestFields,
} from './express/session-middleware.js';
export {
  isLegacyTokenGraceEnabled,
  verifyLegacyBearerToken,
  resetLegacyVerifierForTests,
} from './providers/legacy-cognito/legacy-token-verifier.js';
