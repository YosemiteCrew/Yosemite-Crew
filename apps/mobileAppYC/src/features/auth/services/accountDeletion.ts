import SuperTokens from 'supertokens-react-native';

/**
 * Clears the SuperTokens session after the backend account-withdrawal
 * endpoint has removed the user's data. The backend owns deleting the
 * SuperTokens user record; the client only revokes its session.
 */
export const deleteSupertokensAccount = async (): Promise<void> => {
  try {
    await SuperTokens.signOut();
    console.log('[Auth] SuperTokens session revoked after account deletion');
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to clear the current session.';
    console.warn('[Auth] SuperTokens sign out failed', message);
    throw new Error(message);
  }
};
