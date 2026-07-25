import {deleteSupertokensAccount} from '../../../../src/features/auth/services/accountDeletion';

import SuperTokens from 'supertokens-react-native';

describe('accountDeletion services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('deleteSupertokensAccount', () => {
    it('revokes the SuperTokens session', async () => {
      (SuperTokens.signOut as jest.Mock).mockResolvedValueOnce(undefined);

      await expect(deleteSupertokensAccount()).resolves.not.toThrow();

      expect(SuperTokens.signOut).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        '[Auth] SuperTokens session revoked after account deletion',
      );
    });

    it('throws the underlying error message when sign out fails', async () => {
      (SuperTokens.signOut as jest.Mock).mockRejectedValueOnce(
        new Error('Session already revoked'),
      );

      await expect(deleteSupertokensAccount()).rejects.toThrow(
        'Session already revoked',
      );
      expect(console.warn).toHaveBeenCalledWith(
        '[Auth] SuperTokens sign out failed',
        'Session already revoked',
      );
    });

    it('throws a generic message for non-Error failures', async () => {
      (SuperTokens.signOut as jest.Mock).mockRejectedValueOnce('boom');

      await expect(deleteSupertokensAccount()).rejects.toThrow(
        'Unable to clear the current session.',
      );
    });
  });
});
