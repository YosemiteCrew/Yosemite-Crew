import {
  IntegrationAdapter,
  IntegrationValidationResult,
  XeroCredentials,
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

export class XeroAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: XeroCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const clientIdCheck = ensureNonEmpty(credentials.clientId, "clientId");
    if (!clientIdCheck.ok) return Promise.resolve(clientIdCheck);
    const clientSecretCheck = ensureNonEmpty(
      credentials.clientSecret,
      "clientSecret",
    );
    if (!clientSecretCheck.ok) return Promise.resolve(clientSecretCheck);
    const tenantIdCheck = ensureNonEmpty(credentials.tenantId, "tenantId");
    if (!tenantIdCheck.ok) return Promise.resolve(tenantIdCheck);

    return Promise.resolve({ ok: true });
  }
}
