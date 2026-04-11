import {
  storeTokens,
  loadStoredTokens,
  clearStoredTokens,
  StoredAuthTokens,
} from '@/features/auth/services/tokenStorage';
import * as Keychain from 'react-native-keychain';

jest.mock('react-native-keychain');

describe('tokenStorage', () => {
  const mockTokens: StoredAuthTokens = {
    idToken: 'mock-id-token',
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresAt: Date.now() + 3600000,
    userId: 'user-123',
    provider: 'amplify',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('storeTokens', () => {
    it('should store tokens successfully', async () => {
      (Keychain.setGenericPassword as jest.Mock).mockResolvedValue(true);

      await storeTokens(mockTokens);

      expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
        'yosemite-crew',
        JSON.stringify(mockTokens),
        expect.objectContaining({
          service: 'yosemite-crew-auth-tokens',
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          securityLevel: Keychain.SECURITY_LEVEL.SECURE_SOFTWARE,
        }),
      );
    });

    it('should default provider to amplify when not provided', async () => {
      (Keychain.setGenericPassword as jest.Mock).mockResolvedValue(true);

      const tokensWithoutProvider = {
        idToken: 'id-token',
        accessToken: 'access-token',
      };

      await storeTokens(tokensWithoutProvider);

      const expectedPayload = JSON.stringify({
        ...tokensWithoutProvider,
        provider: 'amplify',
      });

      expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
        'yosemite-crew',
        expectedPayload,
        expect.any(Object),
      );
    });

    it('should throw error when storage fails', async () => {
      (Keychain.setGenericPassword as jest.Mock).mockResolvedValue(false);

      await expect(storeTokens(mockTokens)).rejects.toThrow(
        'Unable to persist auth tokens to secure storage',
      );
    });

    it('should handle keychain errors', async () => {
      const error = new Error('Keychain error');
      (Keychain.setGenericPassword as jest.Mock).mockRejectedValue(error);

      await expect(storeTokens(mockTokens)).rejects.toThrow('Keychain error');
    });

    it('should handle unknown errors', async () => {
      (Keychain.setGenericPassword as jest.Mock).mockRejectedValue('Unknown error');

      await expect(storeTokens(mockTokens)).rejects.toThrow(
        'Unexpected error while storing auth tokens securely',
      );
    });

    it('should store tokens without logging sensitive data', async () => {
      (Keychain.setGenericPassword as jest.Mock).mockResolvedValue(true);

      await storeTokens(mockTokens);

      // Verify no console.log was called (security fix - no logging of tokens)
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('loadStoredTokens', () => {
    it('should load tokens successfully', async () => {
      const credentials = {
        username: 'yosemite-crew',
        password: JSON.stringify(mockTokens),
        service: 'yosemite-crew-auth-tokens',
        storage: 'keychain' as const,
      };

      (Keychain.getGenericPassword as jest.Mock).mockResolvedValue(credentials);

      const result = await loadStoredTokens();

      expect(result).toEqual(mockTokens);
      // Verify no console.log was called (security fix - no logging of tokens)
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should return null when no credentials found', async () => {
      (Keychain.getGenericPassword as jest.Mock).mockResolvedValue(false);

      const result = await loadStoredTokens();

      expect(result).toBeNull();
    });

    it('should default provider to amplify when not in stored tokens', async () => {
      const tokensWithoutProvider = {
        idToken: 'id-token',
        accessToken: 'access-token',
      };

      const credentials = {
        username: 'yosemite-crew',
        password: JSON.stringify(tokensWithoutProvider),
        service: 'yosemite-crew-auth-tokens',
        storage: 'keychain' as const,
      };

      (Keychain.getGenericPassword as jest.Mock).mockResolvedValue(credentials);

      const result = await loadStoredTokens();

      expect(result).toEqual({
        ...tokensWithoutProvider,
        provider: 'amplify',
      });
    });

    it('should return null when JSON parsing fails', async () => {
      const credentials = {
        username: 'yosemite-crew',
        password: 'invalid-json',
        service: 'yosemite-crew-auth-tokens',
        storage: 'keychain' as const,
      };

      (Keychain.getGenericPassword as jest.Mock).mockResolvedValue(credentials);

      const result = await loadStoredTokens();

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to parse tokens from secure storage',
        expect.any(Error),
      );
    });

    it('should handle keychain read errors', async () => {
      const error = new Error('Keychain read error');
      (Keychain.getGenericPassword as jest.Mock).mockRejectedValue(error);

      const result = await loadStoredTokens();

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        'Unable to read tokens from secure storage',
        error,
      );
    });

    it('should handle tokens with all optional fields', async () => {
      const minimalTokens = {
        idToken: 'id-token',
        accessToken: 'access-token',
      };

      const credentials = {
        username: 'yosemite-crew',
        password: JSON.stringify(minimalTokens),
        service: 'yosemite-crew-auth-tokens',
        storage: 'keychain' as const,
      };

      (Keychain.getGenericPassword as jest.Mock).mockResolvedValue(credentials);

      const result = await loadStoredTokens();

      expect(result).toEqual({
        ...minimalTokens,
        provider: 'amplify',
      });
    });
  });

  describe('clearStoredTokens', () => {
    it('should clear tokens successfully', async () => {
      (Keychain.resetGenericPassword as jest.Mock).mockResolvedValue(true);

      await clearStoredTokens();

      expect(Keychain.resetGenericPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'yosemite-crew-auth-tokens',
        }),
      );
    });

    it('should handle errors when clearing tokens', async () => {
      const error = new Error('Keychain reset error');
      (Keychain.resetGenericPassword as jest.Mock).mockRejectedValue(error);

      await expect(clearStoredTokens()).rejects.toThrow('Keychain reset error');
    });

    it('should handle unknown errors when clearing tokens', async () => {
      (Keychain.resetGenericPassword as jest.Mock).mockRejectedValue('Unknown error');

      await expect(clearStoredTokens()).rejects.toThrow(
        'Unexpected error while clearing secure auth tokens',
      );
    });
  });

  describe('integration scenarios', () => {
    it('should store and load tokens correctly', async () => {
      let storedPassword: string | null = null;

      (Keychain.setGenericPassword as jest.Mock).mockImplementation(
        async (username, password) => {
          storedPassword = password;
          return true;
        },
      );

      (Keychain.getGenericPassword as jest.Mock).mockImplementation(async () => {
        if (!storedPassword) return false;
        return {
          username: 'yosemite-crew',
          password: storedPassword,
          service: 'yosemite-crew-auth-tokens',
          storage: 'keychain' as const,
        };
      });

      await storeTokens(mockTokens);
      const loaded = await loadStoredTokens();

      expect(loaded).toEqual(mockTokens);
    });

    it('should clear tokens completely', async () => {
      let storedPassword: string | null = JSON.stringify(mockTokens);

      (Keychain.getGenericPassword as jest.Mock).mockImplementation(async () => {
        if (!storedPassword) return false;
        return {
          username: 'yosemite-crew',
          password: storedPassword,
          service: 'yosemite-crew-auth-tokens',
          storage: 'keychain' as const,
        };
      });

      (Keychain.resetGenericPassword as jest.Mock).mockImplementation(async () => {
        storedPassword = null;
        return true;
      });

      const beforeClear = await loadStoredTokens();
      expect(beforeClear).not.toBeNull();

      await clearStoredTokens();

      const afterClear = await loadStoredTokens();
      expect(afterClear).toBeNull();
    });
  });
});
