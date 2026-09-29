import {
  IntegrationAdapter,
  IntegrationValidationResult,
  RadAnalyzerCredentials,
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

export class RadAnalyzerAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: RadAnalyzerCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const apiKeyCheck = ensureNonEmpty(credentials.apiKey, "apiKey");
    if (!apiKeyCheck.ok) return Promise.resolve(apiKeyCheck);
    const deviceIdCheck = ensureNonEmpty(credentials.deviceId, "deviceId");
    if (!deviceIdCheck.ok) return Promise.resolve(deviceIdCheck);

    return Promise.resolve({ ok: true });
  }
}
