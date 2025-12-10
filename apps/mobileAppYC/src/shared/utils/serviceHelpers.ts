import {getFreshStoredTokens, isTokenExpired} from '@/features/auth/sessionManager';

export const toErrorMessage = (error: unknown, fallback: string): string => {
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
