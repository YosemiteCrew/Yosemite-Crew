import {
  IntegrationAdapter,
  IntegrationValidationResult,
  InventorySyncCredentials,
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

export class InventorySyncAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: InventorySyncCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const apiKeyCheck = ensureNonEmpty(credentials.apiKey, "apiKey");
    if (!apiKeyCheck.ok) return Promise.resolve(apiKeyCheck);
    const warehouseIdCheck = ensureNonEmpty(
      credentials.warehouseId,
      "warehouseId",
    );
    if (!warehouseIdCheck.ok) return Promise.resolve(warehouseIdCheck);

    return Promise.resolve({ ok: true });
  }
}
