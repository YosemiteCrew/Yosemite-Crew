import { isAuthRedirectError, postData } from '@/app/services/axios';
import { logger } from '@/app/lib/logger';

const PROVISION_MAX_ATTEMPTS = 3;
const PROVISION_RETRY_BASE_MS = 800;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Creates the backend user record for a freshly confirmed account. The write
 * is idempotent on the backend, so transient failures (cold start, 429, 5xx)
 * are retried with backoff instead of aborting the whole signup flow.
 * Returns false on persistent transient failure; rethrows auth-loss errors.
 */
export const provisionBackendUser = async (): Promise<boolean> => {
  for (let attempt = 0; attempt < PROVISION_MAX_ATTEMPTS; attempt++) {
    try {
      await postData('/fhir/v1/user');
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
