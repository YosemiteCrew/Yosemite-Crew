import type {
  IdexxCredentials,
  IntegrationAdapter,
  IntegrationCredentials,
  IntegrationValidationResult,
} from "../types";
import { IdexxClient } from "./idexx.client";

const ensureNonEmpty = (value: string | undefined, field: string) => {
  if (!value || !value.trim()) {
    return { ok: false as const, reason: `${field} is required.` };
  }
  return { ok: true as const };
};

const getEnv = (key: string): string | null => {
  const value = process.env[key];
  return value && value.trim() ? value : null;
};

const isIdexxCredentials = (
  credentials: IntegrationCredentials,
): credentials is IdexxCredentials => {
  return (
    typeof (credentials as IdexxCredentials).username === "string" &&
    typeof (credentials as IdexxCredentials).password === "string"
  );
};

export class IdexxAdapter implements IntegrationAdapter {
  async validateCredentials(
    credentials: IntegrationCredentials,
  ): Promise<IntegrationValidationResult> {
    if (!credentials || Object.keys(credentials).length === 0) {
      return { ok: false, reason: "Missing credentials." };
    }

    if (!isIdexxCredentials(credentials)) {
      return { ok: false, reason: "Invalid IDEXX credentials payload." };
    }

    const usernameCheck = ensureNonEmpty(credentials.username, "username");
    if (!usernameCheck.ok) return usernameCheck;

    const passwordCheck = ensureNonEmpty(credentials.password, "password");
    if (!passwordCheck.ok) return passwordCheck;

    const pimsId = getEnv("IDEXX_PIMS_ID");
    if (!pimsId) {
      return { ok: false, reason: "IDEXX_PIMS_ID is not configured." };
    }

    const pimsVersion = getEnv("IDEXX_PIMS_VERSION");
    if (!pimsVersion) {
      return { ok: false, reason: "IDEXX_PIMS_VERSION is not configured." };
    }

    try {
      const client = new IdexxClient({
        username: credentials.username,
        password: credentials.password,
        labAccountId: credentials.labAccountId,
        pimsId,
        pimsVersion,
      });

      await client.validateCredentials();
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "IDEXX validation failed.";
      return { ok: false, reason: message };
    }
  }
}
