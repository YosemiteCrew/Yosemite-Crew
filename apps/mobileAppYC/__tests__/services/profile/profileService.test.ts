import {
  fetchProfileStatus,
  bootstrapProfile,
  ProfileStatusRequest,
  BootstrapProfileRequest,
} from '@/services/profile/profileService';

// Mock the config
jest.mock('@/config/variables', () => ({
  PASSWORDLESS_AUTH_CONFIG: {
    profileServiceUrl: 'https://api.example.com',
    profileBootstrapUrl: 'https://api.example.com/bootstrap',
  },
}));

global.fetch = jest.fn();

describe('profileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchProfileStatus', () => {
    const mockRequest: ProfileStatusRequest = {
      accessToken: 'mock-access-token',
      userId: 'user-123',
      email: 'test@example.com',
    };

    it('should return mock token when profile service URL is not configured', async () => {
      jest.resetModules();
      jest.doMock('@/config/variables', () => ({
        PASSWORDLESS_AUTH_CONFIG: {
          profileServiceUrl: '',
          profileBootstrapUrl: '',
        },
      }));

      const {fetchProfileStatus: fetchProfileStatusNoUrl} = require('@/services/profile/profileService');

      const result = await fetchProfileStatusNoUrl(mockRequest);

      expect(result).toEqual({
        exists: false,
        profileToken: 'mock-profile-token-user-123',
        source: 'mock',
      });

      jest.resetModules();
    });

    it('should fetch profile status from remote successfully', async () => {
      const mockResponse = {
        exists: true,
        profileToken: 'remote-profile-token',
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await fetchProfileStatus(mockRequest);

      expect(result).toEqual({
        exists: true,
        profileToken: 'remote-profile-token',
        source: 'remote',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/profile',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-access-token',
          },
          body: JSON.stringify({
            userId: 'user-123',
            email: 'test@example.com',
          }),
        },
      );
    });

    it('should return fallback when response is not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await fetchProfileStatus(mockRequest);

      expect(result).toEqual({
        exists: false,
        profileToken: 'fallback-profile-token-user-123',
        source: 'fallback',
      });
    });

    it('should handle profile that does not exist', async () => {
      const mockResponse = {
        exists: false,
        profileToken: 'new-profile-token',
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await fetchProfileStatus(mockRequest);

      expect(result).toEqual({
        exists: false,
        profileToken: 'new-profile-token',
        source: 'remote',
      });
    });

    it('should use fallback token when profileToken is missing in response', async () => {
      const mockResponse = {
        exists: true,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await fetchProfileStatus(mockRequest);

      expect(result).toEqual({
        exists: true,
        profileToken: 'profile-token-user-123',
        source: 'remote',
      });
    });

    it('should handle JSON parsing errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const result = await fetchProfileStatus(mockRequest);

      expect(result.source).toBe('remote');
      expect(result.exists).toBe(false);
    });

    it('should handle network errors and return mock token', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await fetchProfileStatus(mockRequest);

      expect(result).toEqual({
        exists: false,
        profileToken: 'mock-profile-token-user-123',
        source: 'mock',
      });

      expect(console.warn).toHaveBeenCalledWith(
        '[ProfileService] Profile status lookup failed; using mock token.',
        expect.any(Error),
      );
    });

    it('should handle various response payload formats', async () => {
      const testCases = [
        {
          payload: {exists: 1, profileToken: 'token'},
          expected: {exists: true, profileToken: 'token', source: 'remote'},
        },
        {
          payload: {exists: 0, profileToken: 'token'},
          expected: {exists: false, profileToken: 'token', source: 'remote'},
        },
        {
          payload: {exists: null},
          expected: {exists: false, profileToken: 'profile-token-user-123', source: 'remote'},
        },
      ];

      for (const {payload, expected} of testCases) {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => payload,
        });

        const result = await fetchProfileStatus(mockRequest);
        expect(result).toEqual(expected);
      }
    });
  });

  describe('bootstrapProfile', () => {
    const mockRequest: BootstrapProfileRequest = {
      accessToken: 'mock-access-token',
      userId: 'user-123',
      email: 'test@example.com',
      provider: 'google',
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'John Doe',
      avatarUrl: 'https://example.com/avatar.jpg',
    };

    it('should return failure when bootstrap URL is not configured', async () => {
      jest.resetModules();
      jest.doMock('@/config/variables', () => ({
        PASSWORDLESS_AUTH_CONFIG: {
          profileServiceUrl: 'https://api.example.com',
          profileBootstrapUrl: '',
        },
      }));

      const {bootstrapProfile: bootstrapProfileNoUrl} = require('@/services/profile/profileService');

      const result = await bootstrapProfileNoUrl(mockRequest);

      expect(result).toEqual({success: false});
      expect(console.warn).toHaveBeenCalledWith(
        '[ProfileService] profileBootstrapUrl is not configured; skipping remote profile bootstrap.',
      );

      jest.resetModules();
    });

    it('should bootstrap profile successfully', async () => {
      const mockResponse = {
        profileToken: 'bootstrap-profile-token',
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await bootstrapProfile(mockRequest);

      expect(result).toEqual({
        success: true,
        profileToken: 'bootstrap-profile-token',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/bootstrap',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-access-token',
          },
          body: JSON.stringify({
            userId: 'user-123',
            email: 'test@example.com',
            provider: 'google',
            firstName: 'John',
            lastName: 'Doe',
            displayName: 'John Doe',
            avatarUrl: 'https://example.com/avatar.jpg',
          }),
        },
      );
    });

    it('should handle response without profileToken', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const result = await bootstrapProfile(mockRequest);

      expect(result).toEqual({
        success: true,
        profileToken: undefined,
      });
    });

    it('should handle bootstrap with minimal data', async () => {
      const minimalRequest: BootstrapProfileRequest = {
        accessToken: 'token',
        userId: 'user-123',
        email: 'test@example.com',
        provider: 'apple',
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({profileToken: 'token'}),
      });

      const result = await bootstrapProfile(minimalRequest);

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/bootstrap',
        expect.objectContaining({
          body: JSON.stringify({
            userId: 'user-123',
            email: 'test@example.com',
            provider: 'apple',
            firstName: undefined,
            lastName: undefined,
            displayName: undefined,
            avatarUrl: undefined,
          }),
        }),
      );
    });

    it('should handle null values for optional fields', async () => {
      const requestWithNulls: BootstrapProfileRequest = {
        accessToken: 'token',
        userId: 'user-123',
        email: 'test@example.com',
        provider: 'facebook',
        firstName: null,
        lastName: null,
        displayName: null,
        avatarUrl: null,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await bootstrapProfile(requestWithNulls);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/bootstrap',
        expect.objectContaining({
          body: expect.stringContaining('"firstName":null'),
        }),
      );
    });

    it('should handle HTTP error responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: async () => 'Profile creation failed',
      });

      const result = await bootstrapProfile(mockRequest);

      expect(result).toEqual({success: false});
      expect(console.error).toHaveBeenCalledWith(
        '[ProfileService] Unable to bootstrap remote profile',
        expect.any(Error),
      );
    });

    it('should handle HTTP error without message', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: async () => '',
      });

      const result = await bootstrapProfile(mockRequest);

      expect(result.success).toBe(false);
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await bootstrapProfile(mockRequest);

      expect(result).toEqual({success: false});
      expect(console.error).toHaveBeenCalledWith(
        '[ProfileService] Unable to bootstrap remote profile',
        expect.any(Error),
      );
    });

    it('should handle JSON parsing errors in response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const result = await bootstrapProfile(mockRequest);

      expect(result).toEqual({
        success: true,
        profileToken: undefined,
      });
    });

    it('should work with different provider types', async () => {
      const providers: Array<'google' | 'apple' | 'facebook'> = ['google', 'apple', 'facebook'];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      for (const provider of providers) {
        await bootstrapProfile({
          ...mockRequest,
          provider,
        });

        expect(global.fetch).toHaveBeenLastCalledWith(
          'https://api.example.com/bootstrap',
          expect.objectContaining({
            body: expect.stringContaining(`"provider":"${provider}"`),
          }),
        );
      }
    });
  });
});
