import {
  IntegrationAdapter,
  IntegrationValidationResult,
  EmailCampaignsCredentials,
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

export class EmailCampaignsAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: EmailCampaignsCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const apiKeyCheck = ensureNonEmpty(credentials.apiKey, "apiKey");
    if (!apiKeyCheck.ok) return Promise.resolve(apiKeyCheck);
    const fromEmailCheck = ensureNonEmpty(credentials.fromEmail, "fromEmail");
    if (!fromEmailCheck.ok) return Promise.resolve(fromEmailCheck);

    return Promise.resolve({ ok: true });
  }
}
