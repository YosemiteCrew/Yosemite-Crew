import {
  IntegrationAdapter,
  IntegrationValidationResult,
  CallIntegrationCredentials,
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

export class CallIntegrationAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: CallIntegrationCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const apiKeyCheck = ensureNonEmpty(credentials.apiKey, "apiKey");
    if (!apiKeyCheck.ok) return Promise.resolve(apiKeyCheck);
    const accountIdCheck = ensureNonEmpty(credentials.accountId, "accountId");
    if (!accountIdCheck.ok) return Promise.resolve(accountIdCheck);

    return Promise.resolve({ ok: true });
  }
}
