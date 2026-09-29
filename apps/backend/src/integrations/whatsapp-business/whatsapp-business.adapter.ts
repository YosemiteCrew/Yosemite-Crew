import {
  IntegrationAdapter,
  IntegrationValidationResult,
  WhatsAppBusinessCredentials,
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

export class WhatsAppBusinessAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: WhatsAppBusinessCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const apiKeyCheck = ensureNonEmpty(credentials.apiKey, "apiKey");
    if (!apiKeyCheck.ok) return Promise.resolve(apiKeyCheck);
    const phoneNumberIdCheck = ensureNonEmpty(
      credentials.phoneNumberId,
      "phoneNumberId",
    );
    if (!phoneNumberIdCheck.ok) return Promise.resolve(phoneNumberIdCheck);

    return Promise.resolve({ ok: true });
  }
}
