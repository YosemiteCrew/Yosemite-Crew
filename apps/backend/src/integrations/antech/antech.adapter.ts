import {
  IntegrationAdapter,
  IntegrationValidationResult,
  AntechCredentials,
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

export class AntechAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: AntechCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const usernameCheck = ensureNonEmpty(credentials.username, "username");
    if (!usernameCheck.ok) return Promise.resolve(usernameCheck);
    const passwordCheck = ensureNonEmpty(credentials.password, "password");
    if (!passwordCheck.ok) return Promise.resolve(passwordCheck);
    const accountIdCheck = ensureNonEmpty(credentials.accountId, "accountId");
    if (!accountIdCheck.ok) return Promise.resolve(accountIdCheck);

    return Promise.resolve({ ok: true });
  }
}
