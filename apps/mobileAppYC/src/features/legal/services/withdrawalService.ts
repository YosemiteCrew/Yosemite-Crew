import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import {getFreshStoredTokens, isTokenExpired} from '@/features/auth/sessionManager';

export type WithdrawalRequestPayload = {
  fullName: string;
  email: string;
  address: string;
  signatureText: string;
  message: string;
  checkboxConfirmed: boolean;
};

const toErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object') {
    const maybeMessage =
      (error as any)?.response?.data?.message ??
      (error as any)?.message ??
      (error as any)?.error;
    if (maybeMessage && typeof maybeMessage === 'string') {
      return maybeMessage;
    }
  }

  return fallback;
};

const ensureAccessContext = async (): Promise<{
  accessToken: string;
  userId: string | null;
}> => {
  const tokens = await getFreshStoredTokens();
  const accessToken = tokens?.accessToken;

  if (!accessToken) {
    throw new Error('Missing access token. Please sign in again.');
  }

  if (isTokenExpired(tokens?.expiresAt ?? undefined)) {
    throw new Error('Your session expired. Please sign in again.');
  }

  return {accessToken, userId: tokens?.userId ?? null};
};

export const withdrawalService = {
  async submitWithdrawal(payload: WithdrawalRequestPayload) {
    try {
      const {accessToken, userId} = await ensureAccessContext();
      const headers = withAuthHeaders(
        accessToken,
        userId ? {'x-user-id': userId} : undefined,
      );

      const {data} = await apiClient.post(
        '/v1/account-withdrawal/withdraw',
        payload,
        {headers},
      );

      return data;
    } catch (error) {
      throw new Error(
        toErrorMessage(error, 'Unable to submit withdrawal request. Please try again.'),
      );
    }
  },
};

export default withdrawalService;
