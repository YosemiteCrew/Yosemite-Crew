import {
  IntegrationAdapter,
  IntegrationValidationResult,
  FormBuilderCredentials,
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

export class FormBuilderAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: FormBuilderCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const apiKeyCheck = ensureNonEmpty(credentials.apiKey, "apiKey");
    if (!apiKeyCheck.ok) return Promise.resolve(apiKeyCheck);
    const orgIdCheck = ensureNonEmpty(credentials.orgId, "orgId");
    if (!orgIdCheck.ok) return Promise.resolve(orgIdCheck);

    return Promise.resolve({ ok: true });
  }
}
