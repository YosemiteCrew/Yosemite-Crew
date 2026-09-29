import {
  IntegrationAdapter,
  IntegrationValidationResult,
  PayrollProviderCredentials,
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

export class PayrollProviderAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: PayrollProviderCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const apiKeyCheck = ensureNonEmpty(credentials.apiKey, "apiKey");
    if (!apiKeyCheck.ok) return Promise.resolve(apiKeyCheck);
    const companyIdCheck = ensureNonEmpty(credentials.companyId, "companyId");
    if (!companyIdCheck.ok) return Promise.resolve(companyIdCheck);

    return Promise.resolve({ ok: true });
  }
}
