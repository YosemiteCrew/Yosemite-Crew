import {
  IntegrationAdapter,
  IntegrationValidationResult,
  SupplyChainCredentials,
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

export class SupplyChainAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: SupplyChainCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const apiKeyCheck = ensureNonEmpty(credentials.apiKey, "apiKey");
    if (!apiKeyCheck.ok) return Promise.resolve(apiKeyCheck);
    const vendorIdCheck = ensureNonEmpty(credentials.vendorId, "vendorId");
    if (!vendorIdCheck.ok) return Promise.resolve(vendorIdCheck);

    return Promise.resolve({ ok: true });
  }
}
