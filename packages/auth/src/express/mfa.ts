import type { SessionRequest } from 'supertokens-node/framework/express';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';
import MultiFactorAuth from 'supertokens-node/recipe/multifactorauth';

export const TOTP_FACTOR_ID = MultiFactorAuth.FactorIds.TOTP;

export async function getRequiredMfaFactorsForUser(userId: string): Promise<string[]> {
  return MultiFactorAuth.getRequiredSecondaryFactorsForUser(userId);
}

export async function getSetupMfaFactorsForUser(userId: string): Promise<string[]> {
  return MultiFactorAuth.getFactorsSetupForUser(userId);
}

export async function isTotpRequiredForUser(userId: string): Promise<boolean> {
  const factors = await getRequiredMfaFactorsForUser(userId);
  return factors.includes(TOTP_FACTOR_ID);
}

export async function isTotpSetupForUser(userId: string): Promise<boolean> {
  const factors = await getSetupMfaFactorsForUser(userId);
  return factors.includes(TOTP_FACTOR_ID);
}

export async function requireTotpForUser(userId: string): Promise<void> {
  await MultiFactorAuth.addToRequiredSecondaryFactorsForUser(userId, TOTP_FACTOR_ID);
}

export async function removeTotpRequirementForUser(userId: string): Promise<void> {
  await MultiFactorAuth.removeFromRequiredSecondaryFactorsForUser(userId, TOTP_FACTOR_ID);
}

export async function getMfaStatusForRequest(req: SessionRequest) {
  const userId = req.session?.getUserId();

  if (!userId) {
    throw new Error('[auth] Session user id is missing');
  }

  const [requiredFactors, setupFactors] = await Promise.all([
    getRequiredMfaFactorsForUser(userId),
    getSetupMfaFactorsForUser(userId),
  ]);

  return {
    userId,
    requiredFactors,
    setupFactors,
    totp: {
      required: requiredFactors.includes(TOTP_FACTOR_ID),
      setup: setupFactors.includes(TOTP_FACTOR_ID),
    },
  };
}

export const requireMfaCompleted = () =>
  verifySession({
    overrideGlobalClaimValidators: async (globalValidators) => [
      ...globalValidators,
      MultiFactorAuth.MultiFactorAuthClaim.validators.hasCompletedMFARequirementsForAuth(),
    ],
  });
