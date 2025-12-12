import apiClient, {withAuthHeaders} from '../../../../src/shared/services/apiClient';
import {
  syncAuthUser,
  AuthUserSignupResponse,
} from '../../../../src/features/auth/services/authUserService';

// --- Mocks ---
jest.mock('../../../../src/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
  withAuthHeaders: jest.fn(),
}));

describe('authUserService', () => {
  const MOCK_AUTH_TOKEN = 'mock-auth-token';
  const MOCK_ID_TOKEN = 'mock-id-token';
  const ENDPOINT = '/v1/authUser/signup';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('syncAuthUser', () => {
    // --- 1. Error Handling ---
    it('throws an error if authToken is missing', async () => {
      await expect(
        syncAuthUser({authToken: '', idToken: 'some-id'}),
      ).rejects.toThrow('Missing auth token for auth sync.');

      expect(apiClient.post).not.toHaveBeenCalled();
    });

    // --- 2. Basic Success Flow (No Parent, No ID Token) ---
    it('calls API with correct headers and handles empty parent (returns undefined summary)', async () => {
      const mockResponse: {data: AuthUserSignupResponse; status: number} = {
        status: 200,
        data: {
          success: true,
          authUser: {
            _id: 'u1',
            authProvider: 'email',
            providerUserId: 'p1',
            email: 'test@test.com',
          },
          parentLinked: false,
          parent: null, // Case: Parent is null
        },
      };

      (withAuthHeaders as jest.Mock).mockReturnValue({
        Authorization: `Bearer ${MOCK_AUTH_TOKEN}`,
      });
      (apiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await syncAuthUser({authToken: MOCK_AUTH_TOKEN});

      // Header Check: idToken was undefined, so extra headers should be undefined
      expect(withAuthHeaders).toHaveBeenCalledWith(
        MOCK_AUTH_TOKEN,
        undefined,
      );

      // API Call Check
      expect(apiClient.post).toHaveBeenCalledWith(ENDPOINT, undefined, {
        headers: {Authorization: `Bearer ${MOCK_AUTH_TOKEN}`},
      });

      // Data Check
      expect(result.success).toBe(true);
      expect(result.parentSummary).toBeUndefined(); // normalizeParentSummary(null)
    });

    // --- 3. Full Data Flow (With ID Token & Full Parent) ---
    it('calls API with ID token and maps full parent profile correctly', async () => {
      const mockParent = {
        _id: 'p123',
        firstName: 'John',
        lastName: 'Doe',
        birthDate: '1990-01-01',
        email: 'john@doe.com',
        phoneNumber: '555-5555',
        profileImageUrl: 'http://img.com/1.jpg',
        isProfileComplete: true,
        address: {
          addressLine: '123 St',
          city: 'City',
          state: 'ST',
          postalCode: '12345',
          country: 'USA',
        },
      };

      const mockResponse = {
        status: 200,
        data: {
          success: true,
          authUser: {_id: 'u1'} as any,
          parentLinked: true,
          parent: mockParent,
        },
      };

      (withAuthHeaders as jest.Mock).mockReturnValue({
        Authorization: 'Bearer token',
        'X-ID-TOKEN': MOCK_ID_TOKEN,
      });
      (apiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await syncAuthUser({
        authToken: MOCK_AUTH_TOKEN,
        idToken: MOCK_ID_TOKEN,
      });

      // Header Check: ensure ID token was passed to withAuthHeaders
      expect(withAuthHeaders).toHaveBeenCalledWith(MOCK_AUTH_TOKEN, {
        'X-ID-TOKEN': MOCK_ID_TOKEN,
      });

      // Normalization Check
      expect(result.parentSummary).toEqual({
        id: 'p123',
        firstName: 'John',
        lastName: 'Doe',
        birthDate: '1990-01-01',
        phoneNumber: '555-5555',
        profileImageUrl: 'http://img.com/1.jpg',
        isComplete: true,
        address: {
          addressLine: '123 St',
          city: 'City',
          state: 'ST',
          postalCode: '12345',
          country: 'USA',
        },
      });
    });

    // --- 4. Branch Coverage: Parent exists but no Address ---
    it('normalizes parent correctly when address is missing', async () => {
      const mockResponse = {
        status: 200,
        data: {
          success: true,
          authUser: {_id: 'u1'} as any,
          parentLinked: true,
          parent: {
            _id: 'p123',
            firstName: 'NoAddress',
            // address is undefined here
          },
        },
      };

      (apiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await syncAuthUser({authToken: MOCK_AUTH_TOKEN});

      expect(result.parentSummary).toBeDefined();
      expect(result.parentSummary?.id).toBe('p123');
      expect(result.parentSummary?.address).toBeUndefined(); // Branch: address check
    });

    // --- 5. Branch Coverage: Parent Object exists but has no _id ---
    it('returns undefined summary if parent object exists but lacks _id', async () => {
      const mockResponse = {
        status: 200,
        data: {
          success: true,
          authUser: {_id: 'u1'} as any,
          parentLinked: false,
          parent: {
            firstName: 'Ghost',
            // _id is missing
          } as any,
        },
      };

      (apiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await syncAuthUser({authToken: MOCK_AUTH_TOKEN});

      // Logic: if (!parent?._id) return undefined
      expect(result.parentSummary).toBeUndefined();
    });
  });
});