import {toErrorMessage, ensureAccessContext} from '../../src/shared/utils/serviceHelpers';
import * as sessionManager from '../../src/features/auth/sessionManager';

jest.mock('../../src/features/auth/sessionManager');

describe('serviceHelpers Utils', () => {
  const FALLBACK_MSG = 'Default Fallback Error';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('toErrorMessage', () => {
    it('returns message from error.response.data.message (highest priority)', () => {
      const error = {
        response: {
          data: {
            message: 'API Specific Error',
          },
        },
        message: 'Standard Error Message',
      };
      expect(toErrorMessage(error, FALLBACK_MSG)).toBe('API Specific Error');
    });

    it('returns message from error.message (second priority)', () => {
      const error = {
        message: 'Standard Error Message',
        error: 'Generic Error',
      };
      expect(toErrorMessage(error, FALLBACK_MSG)).toBe('Standard Error Message');
    });

    it('returns message from error.error (third priority)', () => {
      const error = {
        error: 'Generic Error String',
      };
      expect(toErrorMessage(error, FALLBACK_MSG)).toBe('Generic Error String');
    });

    it('returns fallback if error is null or undefined', () => {
      expect(toErrorMessage(null, FALLBACK_MSG)).toBe(FALLBACK_MSG);
      expect(toErrorMessage(undefined, FALLBACK_MSG)).toBe(FALLBACK_MSG);
    });

    it('returns fallback if error is not an object', () => {
      expect(toErrorMessage('string error', FALLBACK_MSG)).toBe(FALLBACK_MSG);
      expect(toErrorMessage(123, FALLBACK_MSG)).toBe(FALLBACK_MSG);
    });

    it('returns fallback if extracted message is NOT a string', () => {
      const error = {
        message: ['array', 'of', 'errors'], 
      };
      expect(toErrorMessage(error, FALLBACK_MSG)).toBe(FALLBACK_MSG);
    });

    it('returns fallback if extracted message is empty/falsy', () => {
      const error = {
        message: '',
      };
      expect(toErrorMessage(error, FALLBACK_MSG)).toBe(FALLBACK_MSG);
    });
  });

  // ===========================================================================
  // 2. ensureAccessContext
  // ===========================================================================
  describe('ensureAccessContext', () => {
    const mockGetStoredTokens = sessionManager.getFreshStoredTokens as jest.Mock;
    const mockIsTokenExpired = sessionManager.isTokenExpired as jest.Mock;

    it('returns accessToken and userId when tokens exist and are valid', async () => {
      // Setup: Valid tokens, not expired
      mockGetStoredTokens.mockResolvedValue({
        accessToken: 'valid-token-123',
        userId: 'user-456',
        expiresAt: 9999999999,
      });
      mockIsTokenExpired.mockReturnValue(false);

      const result = await ensureAccessContext();

      expect(result).toEqual({
        accessToken: 'valid-token-123',
        userId: 'user-456',
      });
      expect(mockIsTokenExpired).toHaveBeenCalledWith(9999999999);
    });

    it('returns null userId if token exists but userId is missing', async () => {
      // Setup: Valid token, no userId
      mockGetStoredTokens.mockResolvedValue({
        accessToken: 'valid-token-123',
        // userId undefined
        expiresAt: 9999999999,
      });
      mockIsTokenExpired.mockReturnValue(false);

      const result = await ensureAccessContext();

      expect(result).toEqual({
        accessToken: 'valid-token-123',
        userId: null,
      });
    });

    it('throws "Missing access token" if tokens are null', async () => {
      mockGetStoredTokens.mockResolvedValue(null);

      await expect(ensureAccessContext()).rejects.toThrow(
        'Missing access token. Please sign in again.',
      );
    });

    it('throws "Missing access token" if accessToken is empty/undefined', async () => {
      mockGetStoredTokens.mockResolvedValue({
        accessToken: '', // Empty string -> falsy
        expiresAt: 9999999999,
      });

      await expect(ensureAccessContext()).rejects.toThrow(
        'Missing access token. Please sign in again.',
      );
    });

    it('throws "Your session expired" if token is expired', async () => {
      // Setup: Valid token structure, but expired
      mockGetStoredTokens.mockResolvedValue({
        accessToken: 'expired-token',
        expiresAt: 1000,
      });
      mockIsTokenExpired.mockReturnValue(true);

      await expect(ensureAccessContext()).rejects.toThrow(
        'Your session expired. Please sign in again.',
      );

      // Also verify it handles undefined expiresAt gracefully in the call
      expect(mockIsTokenExpired).toHaveBeenCalledWith(1000);
    });

    it('calls isTokenExpired with undefined if expiresAt is missing', async () => {
      // This covers the `tokens?.expiresAt ?? undefined` branch
      mockGetStoredTokens.mockResolvedValue({
        accessToken: 'token-no-expiry',
        // expiresAt missing
      });
      // Assume missing expiry = not expired for this test logic, or mock handles undefined
      mockIsTokenExpired.mockReturnValue(false);

      await ensureAccessContext();

      expect(mockIsTokenExpired).toHaveBeenCalledWith(undefined);
    });
  });
});