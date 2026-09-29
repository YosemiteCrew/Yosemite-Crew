import {
  IntegrationAdapter,
  IntegrationValidationResult,
  PetInsuranceCredentials,
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

export class PetInsuranceAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: PetInsuranceCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const apiKeyCheck = ensureNonEmpty(credentials.apiKey, "apiKey");
    if (!apiKeyCheck.ok) return Promise.resolve(apiKeyCheck);
    const partnerIdCheck = ensureNonEmpty(credentials.partnerId, "partnerId");
    if (!partnerIdCheck.ok) return Promise.resolve(partnerIdCheck);

    return Promise.resolve({ ok: true });
  }
}
