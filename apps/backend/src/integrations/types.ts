export const INTEGRATION_PROVIDERS = ["IDEXX"] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export type IntegrationStatus =
  | "enabled"
  | "disabled"
  | "error"
  | "pending";

export type IntegrationCredentialsStatus =
  | "missing"
  | "invalid"
  | "valid"
  | "pending";

export type IdexxCredentials = {
  username: string;
  password: string;
  labAccountId?: string;
};

export type IntegrationCredentials =
  | IdexxCredentials
  | Record<string, unknown>;
export type IntegrationConfig = Record<string, unknown>;

export type IntegrationValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export interface IntegrationAdapter {
  validateCredentials(
    credentials: IntegrationCredentials,
  ): Promise<IntegrationValidationResult>;
}

export const normalizeProvider = (
  value: string | undefined | null,
): IntegrationProvider | null => {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "IDEXX") return "IDEXX";
  return null;
};
