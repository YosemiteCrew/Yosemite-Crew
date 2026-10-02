import { isAuthRedirectError, postData } from '@/app/services/axios';
import { logger } from '@/app/lib/logger';
import { useAuthStore } from '@/app/stores/authStore';

const PROVISION_RETRY_BASE_MS = 800;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type ProvisionAttempt = { ok: true } | { ok: false; error: unknown };

const attemptProvisioning = async (
  body: { firstName: string; lastName: string; role: string } | undefined
): Promise<ProvisionAttempt> => {
  try {
    await postData('/fhir/v1/user', body);
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error };
  }
};

const recordProvisioningFailure = (result: ProvisionAttempt, attempt: number): boolean => {
  if (result.ok) return true;
  if (isAuthRedirectError(result.error)) throw result.error;
  logger.warn(`Backend user provisioning attempt ${attempt} failed`, result.error);
  return false;
};

/**
 * Creates the backend user record for a freshly confirmed account. The name and
 * role captured on the sign-up form (held in the auth store as pendingSignUp)
 * are sent so the backend persists the selected role to SuperTokens metadata;
 * without it a developer sign-up loses its role on the next /v1/auth/me and is
 * ejected from the developer area. The write is idempotent on the backend, so
 * transient failures (cold start, 429, 5xx) are retried with backoff instead of
 * aborting the whole signup flow. Returns false on persistent transient
 * failure; rethrows auth-loss errors.
 */
export const provisionBackendUser = async (): Promise<boolean> => {
  const { pendingSignUp } = useAuthStore.getState();
  const body = pendingSignUp
    ? {
        firstName: pendingSignUp.firstName,
        lastName: pendingSignUp.lastName,
        role: pendingSignUp.role,
      }
    : undefined;

  const first = await attemptProvisioning(body);
  if (recordProvisioningFailure(first, 1)) return true;

  await delay(PROVISION_RETRY_BASE_MS);
  const second = await attemptProvisioning(body);
  if (recordProvisioningFailure(second, 2)) return true;

  await delay(PROVISION_RETRY_BASE_MS * 2);
  const third = await attemptProvisioning(body);
  return recordProvisioningFailure(third, 3);
};
