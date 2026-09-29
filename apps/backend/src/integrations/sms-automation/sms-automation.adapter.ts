import {
  IntegrationAdapter,
  IntegrationValidationResult,
  SmsAutomationCredentials,
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

export class SmsAutomationAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: SmsAutomationCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const accountSidCheck = ensureNonEmpty(
      credentials.accountSid,
      "accountSid",
    );
    if (!accountSidCheck.ok) return Promise.resolve(accountSidCheck);
    const authTokenCheck = ensureNonEmpty(credentials.authToken, "authToken");
    if (!authTokenCheck.ok) return Promise.resolve(authTokenCheck);
    const fromNumberCheck = ensureNonEmpty(
      credentials.fromNumber,
      "fromNumber",
    );
    if (!fromNumberCheck.ok) return Promise.resolve(fromNumberCheck);

    return Promise.resolve({ ok: true });
  }
}
