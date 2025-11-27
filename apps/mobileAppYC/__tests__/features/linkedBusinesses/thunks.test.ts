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

// --- Mocks ---

// Mock Google Places Service
jest.mock('../../../src/shared/services/maps/googlePlaces', () => ({
  fetchBusinessesBySearch: jest.fn(),
  fetchBusinessPlaceDetails: jest.fn(),
}));

// Mock Images to avoid load issues
jest.mock('../../../src/assets/images', () => ({
  Images: {
    sampleHospital1: 'mock-image-1',
    sampleHospital2: 'mock-image-2',
    sampleHospital3: 'mock-image-3',
  },
}));

describe('features/linkedBusinesses/thunks', () => {
  const mockDispatch = jest.fn();
  const mockGetState = jest.fn();

  beforeAll(() => {
    jest.useFakeTimers();
    // Set a fixed time for cache validation
    jest.setSystemTime(new Date('2023-01-01T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDispatch.mockClear();
    mockGetState.mockClear();
  });

  // Helper to execute thunk
  const callThunk = async (thunk: any, arg: any) => {
    const actionCreator = thunk(arg);
    const promise = actionCreator(mockDispatch, mockGetState, undefined);

    // Fast-forward timers to resolve internal delays
    jest.runAllTimers();

    return await promise;
  };

  // ---------------------------------------------------------------------------
  // searchBusinessesByLocation
  // ---------------------------------------------------------------------------
  describe('searchBusinessesByLocation', () => {
    const mockParams = { query: 'Vet', location: { latitude: 0, longitude: 0 } };
    const mockApiResult = [
      { id: 'place1', name: 'San Francisco Animal Medical Center', address: '123 St' }, // Matches PMS
      { id: 'place2', name: 'Unknown Vet', address: '456 Ave' }, // No Match
    ];

    it('should fetch from API and transform results with PMS matching', async () => {
      (googlePlaces.fetchBusinessesBySearch as jest.Mock).mockResolvedValue(mockApiResult);

      // Use a unique query to avoid cache from previous runs if any
      const params = { ...mockParams, query: 'Unique Query 1' };

      const result = await callThunk(searchBusinessesByLocation, params);

      expect(result.type).toBe('linkedBusinesses/searchByLocation/fulfilled');
      expect(result.payload).toHaveLength(2);

      // Check PMS Matching (First item matches 'biz_sfamc')
      expect(result.payload[0].isPMSRecord).toBe(true);
      expect(result.payload[0].businessId).toBe('biz_sfamc');
      expect(result.payload[0].rating).toBe(4.1);

      // Check Non-Match
      expect(result.payload[1].isPMSRecord).toBe(false);
      expect(result.payload[1].businessId).toBeUndefined();
    });

    it('should use cache on second call', async () => {
      (googlePlaces.fetchBusinessesBySearch as jest.Mock).mockResolvedValue(mockApiResult);
      const params = { ...mockParams, query: 'Cached Query' };

      // First Call
      await callThunk(searchBusinessesByLocation, params);
      expect(googlePlaces.fetchBusinessesBySearch).toHaveBeenCalledTimes(1);

      // Second Call (should use cache)
      await callThunk(searchBusinessesByLocation, params);
      expect(googlePlaces.fetchBusinessesBySearch).toHaveBeenCalledTimes(1); // Count shouldn't increase
    });

    it('should return mock results if API fails', async () => {
      (googlePlaces.fetchBusinessesBySearch as jest.Mock).mockRejectedValue(new Error('API Error'));

      const result = await callThunk(searchBusinessesByLocation, { query: 'Fail' });

      expect(result.type).toBe('linkedBusinesses/searchByLocation/fulfilled'); // It fulfills with mock data
      expect(result.payload).toHaveLength(2); // Returns the hardcoded mock list
      expect(result.payload[0].id).toBe('mock_1');
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
    it('should create a linked business object', async () => {
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
        inviteStatus: 'pending',
      });
      expect(result.payload.id).toContain('linked_');
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
          linkedBusinesses: [{ id: 'linked_1', name: 'Test Biz' }]
        }
      });

      const result = await callThunk(deleteLinkedBusiness, 'linked_1');

      expect(result.type).toBe('linkedBusinesses/delete/fulfilled');
      expect(result.payload).toBe('linked_1');
    });

    it('should fail if business does not exist', async () => {
      mockGetState.mockReturnValue({
        linkedBusinesses: {
          linkedBusinesses: []
        }
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
    it('acceptBusinessInvite returns id', async () => {
      const result = await callThunk(acceptBusinessInvite, 'id_1');
      expect(result.type).toBe('linkedBusinesses/acceptInvite/fulfilled');
      expect(result.payload).toBe('id_1');
    });

    it('declineBusinessInvite returns id', async () => {
      const result = await callThunk(declineBusinessInvite, 'id_1');
      expect(result.type).toBe('linkedBusinesses/declineInvite/fulfilled');
      expect(result.payload).toBe('id_1');
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
      (googlePlaces.fetchBusinessPlaceDetails as jest.Mock).mockResolvedValue(mockDetails);

      const result = await callThunk(fetchBusinessDetails, 'place_123');

      expect(result.type).toBe('linkedBusinesses/fetchDetails/fulfilled');
      expect(result.payload).toEqual({
        placeId: 'place_123',
        ...mockDetails,
      });
    });

    it('should use cache on second call', async () => {
      (googlePlaces.fetchBusinessPlaceDetails as jest.Mock).mockResolvedValue(mockDetails);

      // First call
      await callThunk(fetchBusinessDetails, 'place_unique_1');
      expect(googlePlaces.fetchBusinessPlaceDetails).toHaveBeenCalledTimes(1);

      // Second call
      await callThunk(fetchBusinessDetails, 'place_unique_1');
      expect(googlePlaces.fetchBusinessPlaceDetails).toHaveBeenCalledTimes(1); // Cache hit
    });

    it('should return empty structure on error', async () => {
      (googlePlaces.fetchBusinessPlaceDetails as jest.Mock).mockRejectedValue(new Error('Network Error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

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