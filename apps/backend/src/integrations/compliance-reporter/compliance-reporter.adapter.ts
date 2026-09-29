import {
  IntegrationAdapter,
  IntegrationValidationResult,
  ComplianceReporterCredentials,
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

export class ComplianceReporterAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: ComplianceReporterCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const apiKeyCheck = ensureNonEmpty(credentials.apiKey, "apiKey");
    if (!apiKeyCheck.ok) return Promise.resolve(apiKeyCheck);
    const jurisdictionCheck = ensureNonEmpty(
      credentials.jurisdiction,
      "jurisdiction",
    );
    if (!jurisdictionCheck.ok) return Promise.resolve(jurisdictionCheck);

    return Promise.resolve({ ok: true });
  }
}
