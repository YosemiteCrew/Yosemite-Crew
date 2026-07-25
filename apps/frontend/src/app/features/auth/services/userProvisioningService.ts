import { isAuthRedirectError, postData } from '@/app/services/axios';
import { logger } from '@/app/lib/logger';
import { useAuthStore } from '@/app/stores/authStore';

const PROVISION_MAX_ATTEMPTS = 3;
const PROVISION_RETRY_BASE_MS = 800;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
  for (let attempt = 0; attempt < PROVISION_MAX_ATTEMPTS; attempt++) {
    try {
      await postData('/fhir/v1/user', body);
      return true;
    } catch (error) {
      if (isAuthRedirectError(error)) throw error;
      logger.warn(`Backend user provisioning attempt ${attempt + 1} failed`, error);
      if (attempt < PROVISION_MAX_ATTEMPTS - 1) {
        await delay(PROVISION_RETRY_BASE_MS * 2 ** attempt);
      }
    }
  }
  return false;
};
