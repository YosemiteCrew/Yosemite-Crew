import { isProviderAvailable } from "./providerAvailability";
import type { IntegrationProvider, IntegrationValidationResult } from "./types";

/**
 * Shape check for a provider that has no client yet: it confirms the fields are
 * present and non-empty and nothing more.
 *
 * It deliberately refuses for an available provider. That is what stops a
 * provider being marked available while its adapter is still this shape check,
 * which would accept any text as working credentials.
 */
export const validateRequiredCredentials = <T extends object>(
  provider: IntegrationProvider,
  credentials: T | undefined,
  fields: ReadonlyArray<keyof T & string>,
): Promise<IntegrationValidationResult> => {
  if (isProviderAvailable(provider)) {
    return Promise.resolve({
      ok: false,
      reason: `${provider} must verify the connection before it can be saved.`,
    });
  }
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
