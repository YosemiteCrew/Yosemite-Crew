import { IntegrationValidationResult } from "./types";

export const validateRequiredCredentials = <T extends object>(
  credentials: T | undefined,
  fields: ReadonlyArray<keyof T & string>,
): Promise<IntegrationValidationResult> => {
  if (!credentials || Object.keys(credentials).length === 0) {
    return Promise.resolve({ ok: false, reason: "Missing credentials." });
  }
  for (const field of fields) {
    const value = credentials[field];
    if (typeof value !== "string" || !value.trim()) {
      return Promise.resolve({ ok: false, reason: `${field} is required.` });
    }
  }
  return Promise.resolve({ ok: true });
};
