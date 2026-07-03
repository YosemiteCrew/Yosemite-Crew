import { postData } from '@/app/services/axios';
import { useAuthStore } from '@/app/stores/authStore';

const getResponseStatus = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return undefined;
  }
  const response = (error as { response?: { status?: unknown } }).response;
  return typeof response?.status === 'number' ? response.status : undefined;
};

/**
 * Provision the application user record after the first fully-authenticated
 * sign-in of a fresh sign-up. The name/role captured on the sign-up form are
 * kept in the auth store until this call succeeds. A 409 means the user is
 * already provisioned — treated as success.
 */
export const provisionPendingSignUpUser = async (): Promise<void> => {
  const { pendingSignUp, clearPendingSignUp } = useAuthStore.getState();
  if (!pendingSignUp) return;
  try {
    await postData('/fhir/v1/user', {
      firstName: pendingSignUp.firstName,
      lastName: pendingSignUp.lastName,
      role: pendingSignUp.role,
    });
    clearPendingSignUp();
  } catch (error) {
    if (getResponseStatus(error) === 409) {
      clearPendingSignUp();
      return;
    }
    throw error;
  }
};
