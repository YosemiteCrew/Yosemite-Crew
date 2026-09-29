import {
  IntegrationAdapter,
  IntegrationValidationResult,
  QuickBooksCredentials,
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

export class QuickBooksAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: QuickBooksCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const realmIdCheck = ensureNonEmpty(credentials.realmId, "realmId");
    if (!realmIdCheck.ok) return Promise.resolve(realmIdCheck);
    const accessTokenCheck = ensureNonEmpty(
      credentials.accessToken,
      "accessToken",
    );
    if (!accessTokenCheck.ok) return Promise.resolve(accessTokenCheck);
    const refreshTokenCheck = ensureNonEmpty(
      credentials.refreshToken,
      "refreshToken",
    );
    if (!refreshTokenCheck.ok) return Promise.resolve(refreshTokenCheck);

    return Promise.resolve({ ok: true });
  }
}
