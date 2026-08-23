import {
  getFreshStoredTokens,
  isTokenExpired,
} from '@/features/auth/sessionManager';

export const SESSION_EXPIRED_MESSAGE =
  'Your session expired. Please sign in again.';

export const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object') {
    // 401 first, before any server text.
    //
    // A session that dies between the token check and the request comes back
    // as `{"message":"try refresh token"}`, and axios's own message is
    // "Request failed with status code 401". Both were reaching the screen -
    // that is what a pet parent saw on the passport after leaving the app
    // open overnight. Neither tells them the one thing they can act on, and
    // "try refresh token" is an instruction to the client, not to a person.
    const status = (error as {response?: {status?: number}})?.response?.status;
    if (status === 401) {
      return SESSION_EXPIRED_MESSAGE;
    }

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

export const ensureAccessContext = async (): Promise<{
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
