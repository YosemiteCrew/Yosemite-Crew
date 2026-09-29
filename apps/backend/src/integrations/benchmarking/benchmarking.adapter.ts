import {
  IntegrationAdapter,
  IntegrationValidationResult,
  BenchmarkingCredentials,
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

export class BenchmarkingAdapter implements IntegrationAdapter {
  validateCredentials(
    credentials: BenchmarkingCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return Promise.resolve({ ok: false, reason: "Missing credentials." });
    }

    const apiKeyCheck = ensureNonEmpty(credentials.apiKey, "apiKey");
    if (!apiKeyCheck.ok) return Promise.resolve(apiKeyCheck);
    const practiceIdCheck = ensureNonEmpty(
      credentials.practiceId,
      "practiceId",
    );
    if (!practiceIdCheck.ok) return Promise.resolve(practiceIdCheck);

    return Promise.resolve({ ok: true });
  }
}
