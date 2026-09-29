import {
  IntegrationAdapter,
  IntegrationValidationResult,
  ClinicalKeyCredentials,
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

export class ClinicalKeyAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: ClinicalKeyCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const usernameCheck = ensureNonEmpty(credentials.username, "username");
    if (!usernameCheck.ok) return Promise.resolve(usernameCheck);
    const passwordCheck = ensureNonEmpty(credentials.password, "password");
    if (!passwordCheck.ok) return Promise.resolve(passwordCheck);

    return Promise.resolve({ ok: true });
  }
}
