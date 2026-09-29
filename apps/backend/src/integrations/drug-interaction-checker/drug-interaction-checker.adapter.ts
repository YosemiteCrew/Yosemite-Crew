import {
  IntegrationAdapter,
  IntegrationValidationResult,
  DrugInteractionCheckerCredentials,
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

export class DrugInteractionCheckerAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: DrugInteractionCheckerCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const apiKeyCheck = ensureNonEmpty(credentials.apiKey, "apiKey");
    if (!apiKeyCheck.ok) return Promise.resolve(apiKeyCheck);

    return Promise.resolve({ ok: true });
  }
}
