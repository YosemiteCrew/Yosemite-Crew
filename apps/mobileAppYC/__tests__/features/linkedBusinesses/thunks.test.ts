import {
  searchBusinessesByLocation,
  searchBusinessByQRCode,
  addLinkedBusiness,
  deleteLinkedBusiness,
  acceptBusinessInvite,
  declineBusinessInvite,
  fetchBusinessDetails,
} from '../../../src/features/linkedBusinesses/thunks';
import * as googlePlaces from '../../../src/shared/services/maps/googlePlaces';
import linkedBusinessesService from '../../../src/features/linkedBusinesses/services/linkedBusinessesService';
import {
  getFreshStoredTokens,
  isTokenExpired,
} from '../../../src/features/auth/sessionManager';

// --- Mocks ---

// Mock Google Places Service
jest.mock('../../../src/shared/services/maps/googlePlaces', () => ({
  fetchBusinessesBySearch: jest.fn(),
  fetchBusinessPlaceDetails: jest.fn(),
}));

// Mock Images
jest.mock('../../../src/assets/images', () => ({
  Images: {
    sampleHospital1: 'mock-image-1',
    sampleHospital2: 'mock-image-2',
    sampleHospital3: 'mock-image-3',
  },
}));

// Mock Session Manager (Auth)
jest.mock('../../../src/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(),
  isTokenExpired: jest.fn(),
}));

// Mock Linked Businesses Service (API)
jest.mock(
  '../../../src/features/linkedBusinesses/services/linkedBusinessesService',
  () => ({
    revokeLinkedBusiness: jest.fn(),
    approveLinkInvite: jest.fn(),
    denyLinkInvite: jest.fn(),
    fetchLinkedBusinesses: jest.fn(),
    inviteBusiness: jest.fn(),
    linkBusiness: jest.fn(),
    checkBusiness: jest.fn(),
  }),
);

describe('features/linkedBusinesses/thunks', () => {
  const mockDispatch = jest.fn();
  const mockGetState = jest.fn();

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-01-01T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDispatch.mockClear();
    mockGetState.mockClear();

    // Default successful auth setup
    (getFreshStoredTokens as jest.Mock).mockResolvedValue({
      accessToken: 'mock-access-token',
      expiresAt: Date.now() + 10000,
    });
    (isTokenExpired as jest.Mock).mockReturnValue(false);
  });

  // Helper to execute thunk
  const callThunk = async (thunk: any, arg: any) => {
    const actionCreator = thunk(arg);
    const promise = actionCreator(mockDispatch, mockGetState, undefined);

    // Fast-forward timers to resolve internal delays (debounce, artificial delays)
    jest.runAllTimers();

    return await promise;
  };

  // ---------------------------------------------------------------------------
  // searchBusinessesByLocation
  // ---------------------------------------------------------------------------
  describe('searchBusinessesByLocation', () => {
    const mockParams = {query: 'Vet', location: {latitude: 0, longitude: 0}};
    const mockApiResult = [
      {
        id: 'place1',
        name: 'San Francisco Animal Medical Center',
        address: '123 St',
      },
      {id: 'place2', name: 'Unknown Vet', address: '456 Ave'},
    ];

    it('should fetch from API and map results (isPMSRecord defaults to false)', async () => {
      (googlePlaces.fetchBusinessesBySearch as jest.Mock).mockResolvedValue(
        mockApiResult,
      );

      const params = {...mockParams, query: 'Unique Query 1'};
      const result = await callThunk(searchBusinessesByLocation, params);

      expect(result.type).toBe('linkedBusinesses/searchByLocation/fulfilled');
      expect(result.payload).toHaveLength(2);

      // The provided thunk implementation sets isPMSRecord: false for all google results
      // PMS checking is handled by a separate thunk (checkOrganisation)
      expect(result.payload[0].id).toBe('place1');
      expect(result.payload[0].isPMSRecord).toBe(false);
      expect(result.payload[1].id).toBe('place2');
    });

    it('should use cache on second call', async () => {
      (googlePlaces.fetchBusinessesBySearch as jest.Mock).mockResolvedValue(
        mockApiResult,
      );
      const params = {...mockParams, query: 'Cached Query'};

      // First Call
      await callThunk(searchBusinessesByLocation, params);
      expect(googlePlaces.fetchBusinessesBySearch).toHaveBeenCalledTimes(1);

      // Second Call (should use cache)
      await callThunk(searchBusinessesByLocation, params);
      expect(googlePlaces.fetchBusinessesBySearch).toHaveBeenCalledTimes(1);
    });

    it('should return empty array if API fails', async () => {
      (googlePlaces.fetchBusinessesBySearch as jest.Mock).mockRejectedValue(
        new Error('API Error'),
      );

      // The provided implementation catches error and returns []
      const result = await callThunk(searchBusinessesByLocation, {
        query: 'Fail',
      });

      expect(result.type).toBe('linkedBusinesses/searchByLocation/fulfilled');
      expect(result.payload).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // searchBusinessByQRCode
  // ---------------------------------------------------------------------------
  describe('searchBusinessByQRCode', () => {
    it('should return business for valid QR code', async () => {
      const result = await callThunk(searchBusinessByQRCode, 'PMS_SFAMC_001');

      expect(result.type).toBe('linkedBusinesses/searchByQRCode/fulfilled');
      expect(result.payload.id).toBe('biz_sfamc');
      expect(result.payload.name).toContain('San Francisco');
    });

    it('should throw error for invalid QR code', async () => {
      const result = await callThunk(searchBusinessByQRCode, 'INVALID_CODE');

      expect(result.type).toBe('linkedBusinesses/searchByQRCode/rejected');
      expect(result.error.message).toBe('Business not found for this QR code');
    });
  });

  // ---------------------------------------------------------------------------
  // addLinkedBusiness
  // ---------------------------------------------------------------------------
  describe('addLinkedBusiness', () => {
    it('should create a linked business object with accepted status', async () => {
      const input = {
        companionId: 'c1',
        businessId: 'b1',
        businessName: 'Vet',
        category: 'hospital',
      };

      const result = await callThunk(addLinkedBusiness, input);

      expect(result.type).toBe('linkedBusinesses/add/fulfilled');
      expect(result.payload).toMatchObject({
        companionId: 'c1',
        businessId: 'b1',
        // The implementation creates it as 'accepted', not 'pending'
        inviteStatus: 'accepted',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // deleteLinkedBusiness
  // ---------------------------------------------------------------------------
  describe('deleteLinkedBusiness', () => {
    it('should delete successfully if business exists', async () => {
      // Mock State to contain the business
      mockGetState.mockReturnValue({
        linkedBusinesses: {
          linkedBusinesses: [{id: 'linked_1', name: 'Test Biz'}],
        },
      });

      (
        linkedBusinessesService.revokeLinkedBusiness as jest.Mock
      ).mockResolvedValue({});

      const result = await callThunk(deleteLinkedBusiness, 'linked_1');

      expect(result.type).toBe('linkedBusinesses/delete/fulfilled');
      expect(result.payload).toBe('linked_1');
      expect(linkedBusinessesService.revokeLinkedBusiness).toHaveBeenCalled();
    });

    it('should fail if business does not exist in state', async () => {
      mockGetState.mockReturnValue({
        linkedBusinesses: {
          linkedBusinesses: [],
        },
      });

      const result = await callThunk(deleteLinkedBusiness, 'linked_999');

      expect(result.type).toBe('linkedBusinesses/delete/rejected');
      expect(result.payload).toBe('Business not found');
    });
  });

  // ---------------------------------------------------------------------------
  // acceptBusinessInvite / declineBusinessInvite
  // ---------------------------------------------------------------------------
  describe('Invite Actions', () => {
    it('acceptBusinessInvite returns updated business', async () => {
      mockGetState.mockReturnValue({
        linkedBusinesses: {
          linkedBusinesses: [
            {id: 'id_1', name: 'Pending Biz', inviteStatus: 'pending'},
          ],
        },
      });

      (
        linkedBusinessesService.approveLinkInvite as jest.Mock
      ).mockResolvedValue({
        id: 'id_1',
        name: 'Approved Biz',
      });

      const result = await callThunk(acceptBusinessInvite, 'id_1');

      expect(result.type).toBe('linkedBusinesses/acceptInvite/fulfilled');
      expect(result.payload.id).toBe('id_1');
      expect(result.payload.inviteStatus).toBe('accepted');
    });

    it('declineBusinessInvite returns updated business', async () => {
      mockGetState.mockReturnValue({
        linkedBusinesses: {
          linkedBusinesses: [
            {id: 'id_1', name: 'Pending Biz', inviteStatus: 'pending'},
          ],
        },
      });

      (linkedBusinessesService.denyLinkInvite as jest.Mock).mockResolvedValue({
        id: 'id_1',
        name: 'Denied Biz',
      });

      const result = await callThunk(declineBusinessInvite, 'id_1');

      expect(result.type).toBe('linkedBusinesses/declineInvite/fulfilled');
      expect(result.payload.id).toBe('id_1');
      expect(result.payload.inviteStatus).toBe('declined');
    });
  });

  // ---------------------------------------------------------------------------
  // fetchBusinessDetails
  // ---------------------------------------------------------------------------
  describe('fetchBusinessDetails', () => {
    const mockDetails = {
      photoUrl: 'http://photo.com',
      phoneNumber: '123-456',
      website: 'http://site.com',
    };

    it('should fetch details from API and cache them', async () => {
      (googlePlaces.fetchBusinessPlaceDetails as jest.Mock).mockResolvedValue(
        mockDetails,
      );

      const result = await callThunk(fetchBusinessDetails, 'place_123');

      expect(result.type).toBe('linkedBusinesses/fetchDetails/fulfilled');
      expect(result.payload).toEqual({
        placeId: 'place_123',
        ...mockDetails,
      });
    });

    it('should use cache on second call', async () => {
      (googlePlaces.fetchBusinessPlaceDetails as jest.Mock).mockResolvedValue(
        mockDetails,
      );

      // First call
      await callThunk(fetchBusinessDetails, 'place_unique_1');
      expect(googlePlaces.fetchBusinessPlaceDetails).toHaveBeenCalledTimes(1);

      // Second call
      await callThunk(fetchBusinessDetails, 'place_unique_1');
      expect(googlePlaces.fetchBusinessPlaceDetails).toHaveBeenCalledTimes(1); // Cache hit
    });

    it('should return empty structure on error', async () => {
      (googlePlaces.fetchBusinessPlaceDetails as jest.Mock).mockRejectedValue(
        new Error('Network Error'),
      );
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const result = await callThunk(fetchBusinessDetails, 'place_error');

      expect(result.type).toBe('linkedBusinesses/fetchDetails/fulfilled'); // Thunk swallows error and returns partial
      expect(result.payload).toEqual({
        placeId: 'place_error',
        photoUrl: undefined,
        phoneNumber: undefined,
        website: undefined,
      });

      consoleSpy.mockRestore();
    });
  });
});