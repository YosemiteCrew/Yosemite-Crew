import {
  IntegrationAdapter,
  IntegrationValidationResult,
  PharmacyIntegrationCredentials,
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

export class PharmacyIntegrationAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: PharmacyIntegrationCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const apiKeyCheck = ensureNonEmpty(credentials.apiKey, "apiKey");
    if (!apiKeyCheck.ok) return Promise.resolve(apiKeyCheck);
    const pharmacyIdCheck = ensureNonEmpty(
      credentials.pharmacyId,
      "pharmacyId",
    );
    if (!pharmacyIdCheck.ok) return Promise.resolve(pharmacyIdCheck);

    return Promise.resolve({ ok: true });
  }
}
