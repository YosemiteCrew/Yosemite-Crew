import {
  IntegrationAdapter,
  IntegrationValidationResult,
  ECommerceCredentials,
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

export class ECommerceAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: ECommerceCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const apiKeyCheck = ensureNonEmpty(credentials.apiKey, "apiKey");
    if (!apiKeyCheck.ok) return Promise.resolve(apiKeyCheck);
    const storeIdCheck = ensureNonEmpty(credentials.storeId, "storeId");
    if (!storeIdCheck.ok) return Promise.resolve(storeIdCheck);

    return Promise.resolve({ ok: true });
  }
}
