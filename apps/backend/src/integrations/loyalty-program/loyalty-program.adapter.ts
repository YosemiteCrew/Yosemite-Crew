import {
  IntegrationAdapter,
  IntegrationValidationResult,
  LoyaltyProgramCredentials,
} from "../types";

const ensureNonEmpty = (
  value: string | undefined,
  field: string,
): IntegrationValidationResult => {
  if (!value?.trim()) {
    return { ok: false, reason: `${field} is required.` };
  }
  return { ok: true };
};

export class LoyaltyProgramAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: LoyaltyProgramCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const apiKeyCheck = ensureNonEmpty(credentials.apiKey, "apiKey");
    if (!apiKeyCheck.ok) return Promise.resolve(apiKeyCheck);
    const programIdCheck = ensureNonEmpty(credentials.programId, "programId");
    if (!programIdCheck.ok) return Promise.resolve(programIdCheck);

    return Promise.resolve({ ok: true });
  }
}
