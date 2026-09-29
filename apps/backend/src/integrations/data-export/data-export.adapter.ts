import {
  IntegrationAdapter,
  IntegrationValidationResult,
  DataExportCredentials,
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

export class DataExportAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: DataExportCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const apiKeyCheck = ensureNonEmpty(credentials.apiKey, "apiKey");
    if (!apiKeyCheck.ok) return Promise.resolve(apiKeyCheck);
    const exportScopeCheck = ensureNonEmpty(
      credentials.exportScope,
      "exportScope",
    );
    if (!exportScopeCheck.ok) return Promise.resolve(exportScopeCheck);

    return Promise.resolve({ ok: true });
  }
}
