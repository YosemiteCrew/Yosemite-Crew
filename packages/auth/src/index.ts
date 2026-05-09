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
