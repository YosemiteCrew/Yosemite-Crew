import {
  IntegrationAdapter,
  IntegrationValidationResult,
  WebsiteBuilderCredentials,
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

export class WebsiteBuilderAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: WebsiteBuilderCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const apiKeyCheck = ensureNonEmpty(credentials.apiKey, "apiKey");
    if (!apiKeyCheck.ok) return Promise.resolve(apiKeyCheck);
    const domainCheck = ensureNonEmpty(credentials.domain, "domain");
    if (!domainCheck.ok) return Promise.resolve(domainCheck);

    return Promise.resolve({ ok: true });
  }
}
