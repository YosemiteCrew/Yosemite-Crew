import {
  IntegrationAdapter,
  IntegrationValidationResult,
  HeskaCredentials,
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

export class HeskaAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: HeskaCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const apiKeyCheck = ensureNonEmpty(credentials.apiKey, "apiKey");
    if (!apiKeyCheck.ok) return Promise.resolve(apiKeyCheck);
    const deviceSerialCheck = ensureNonEmpty(
      credentials.deviceSerial,
      "deviceSerial",
    );
    if (!deviceSerialCheck.ok) return Promise.resolve(deviceSerialCheck);

    return Promise.resolve({ ok: true });
  }
}
