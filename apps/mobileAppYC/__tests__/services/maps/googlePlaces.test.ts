import {
  fetchPlaceSuggestions,
  fetchPlaceDetails,
  fetchBusinessPlaceDetails,
  fetchBusinessesBySearch,
  MissingApiKeyError,
} from '@/shared/services/maps/googlePlaces';
import {GOOGLE_PLACES_CONFIG} from '@/config/variables';

// 1. Mock the config variables
jest.mock('@/config/variables', () => ({
  GOOGLE_PLACES_CONFIG: {
    apiKey: 'TEST_API_KEY',
  },
}));

describe('Google Places Service', () => {
  // Save original fetch
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Default valid API key
    GOOGLE_PLACES_CONFIG.apiKey = 'TEST_API_KEY';
    // Mock global fetch
    globalThis.fetch = jest.fn();
  });

  afterAll(() => {
    // Restore global fetch
    globalThis.fetch = originalFetch;
  });

  // Helper to mock successful fetch response
  const mockFetchSuccess = (data: any) => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    });
  };

  // Helper to mock error fetch response
  const mockFetchError = (statusText: string = 'Error') => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      text: () => Promise.resolve(statusText),
    });
  };

  describe('Common Validation', () => {
    it('throws MissingApiKeyError if API key is missing', async () => {
      GOOGLE_PLACES_CONFIG.apiKey = ''; // Simulate missing key
      await expect(fetchPlaceSuggestions({query: 'test'})).rejects.toThrow(
        MissingApiKeyError,
      );
      await expect(fetchPlaceDetails('123')).rejects.toThrow(
        MissingApiKeyError,
      );
      await expect(fetchBusinessPlaceDetails('123')).rejects.toThrow(
        MissingApiKeyError,
      );
      await expect(fetchBusinessesBySearch({query: 'test'})).rejects.toThrow(
        MissingApiKeyError,
      );
    });
  });

  describe('fetchPlaceSuggestions', () => {
    it('returns empty array if query is empty or whitespace', async () => {
      const result = await fetchPlaceSuggestions({query: '   '});
      expect(result).toEqual([]);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('fetches and normalizes suggestions successfully', async () => {
      const mockResponse = {
        suggestions: [
          {
            placePrediction: {
              placeId: 'place_123',
              structuredFormat: {
                mainText: {text: 'Main St'},
                secondaryText: {text: 'City, State'},
              },
            },
          },
          {
            placePrediction: {
              placeId: 'place_456',
              text: {text: 'Just Text'},
              // missing structuredFormat
            },
          },
          {
            // Invalid entry without placeId
            placePrediction: {},
          },
        ],
      };
      mockFetchSuccess(mockResponse);

      const result = await fetchPlaceSuggestions({query: 'Main'});

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('places:autocomplete'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Goog-Api-Key': 'TEST_API_KEY',
          }),
          body: expect.stringContaining('"input":"Main"'),
        }),
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        placeId: 'place_123',
        primaryText: 'Main St',
        secondaryText: 'City, State',
      });
      expect(result[1]).toEqual({
        placeId: 'place_456',
        primaryText: 'Just Text', // Fallback to text.text
        secondaryText: undefined,
      });
    });

    it('handles location bias correctly', async () => {
      mockFetchSuccess({});
      await fetchPlaceSuggestions({
        query: 'Gym',
        location: {latitude: 10, longitude: 20},
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"locationBias":{"circle":'),
        }),
      );
    });

    it('throws error on failed API response', async () => {
      mockFetchError('Invalid Request');
      await expect(fetchPlaceSuggestions({query: 'test'})).rejects.toThrow(
        'Invalid Request',
      );
    });

    it('handles empty/malformed API response gracefully', async () => {
      mockFetchSuccess(null); // API returns null/empty
      const result = await fetchPlaceSuggestions({query: 'test'});
      expect(result).toEqual([]);
    });
  });

  describe('fetchPlaceDetails', () => {
    it('throws error if placeId is missing', async () => {
      await expect(fetchPlaceDetails('')).rejects.toThrow(
        'A valid placeId is required',
      );
    });

    it('fetches and maps address components correctly', async () => {
      const mockResponse = {
        formattedAddress: '123 Main St, City, ST 12345, USA',
        location: {latitude: 40.7128, longitude: -74.006},
        addressComponents: [
          {types: ['street_number'], longText: '123'},
          {types: ['route'], longText: 'Main St'},
          {types: ['locality'], longText: 'City'},
          {types: ['administrative_area_level_1'], shortText: 'ST'},
          {types: ['postal_code'], longText: '12345'},
          {types: ['country'], longText: 'USA'},
        ],
      };
      mockFetchSuccess(mockResponse);

      const result = await fetchPlaceDetails('place_id_123');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/places/place_id_123?languageCode=en'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-Goog-FieldMask': expect.stringContaining('formattedAddress'),
          }),
        }),
      );

      expect(result).toEqual({
        addressLine: '123 Main St',
        city: 'City',
        stateProvince: 'ST',
        postalCode: '12345',
        country: 'USA',
        formattedAddress: '123 Main St, City, ST 12345, USA',
        latitude: 40.7128,
        longitude: -74.006,
      });
    });

    it('handles subpremise in address line generation', async () => {
      const mockResponse = {
        addressComponents: [
          {types: ['subpremise'], longText: 'Apt 4B'},
          {types: ['street_number'], longText: '55'},
          {types: ['route'], longText: 'Broadway'},
        ],
      };
      mockFetchSuccess(mockResponse);

      const result = await fetchPlaceDetails('pid');
      // Expect logic: `${subpremise}/` + street + route
      expect(result.addressLine).toBe('Apt 4B/ 55 Broadway');
    });

    it('falls back to formattedAddress if address parts missing', async () => {
      const mockResponse = {
        formattedAddress: 'Simple Formatted Address',
        addressComponents: [], // No components
      };
      mockFetchSuccess(mockResponse);

      const result = await fetchPlaceDetails('pid');
      expect(result.addressLine).toBe('Simple Formatted Address');
    });
  });

  describe('fetchBusinessPlaceDetails', () => {
    it('fetches business specific details correctly', async () => {
      const mockResponse = {
        nationalPhoneNumber: '(555) 123-4567',
        websiteUri: 'https://example.com',
        location: {latitude: 10, longitude: 10},
        photos: [{name: 'places/PLACE_ID/photos/PHOTO_ID'}],
      };
      mockFetchSuccess(mockResponse);

      const result = await fetchBusinessPlaceDetails('biz_123');

      expect(result).toEqual({
        phoneNumber: '(555) 123-4567',
        website: 'https://example.com',
        latitude: 10,
        longitude: 10,
        photoName: 'places/PLACE_ID/photos/PHOTO_ID',
        photoUrl:
          'https://places.googleapis.com/v1/places/PLACE_ID/photos/PHOTO_ID/media?key=TEST_API_KEY&max_height_px=400&max_width_px=400',
        formattedAddress: undefined,
      });
    });

    it('handles missing photos gracefully', async () => {
      const mockResponse = {
        nationalPhoneNumber: '123',
        photos: [], // Empty photos
      };
      mockFetchSuccess(mockResponse);

      const result = await fetchBusinessPlaceDetails('biz_123');
      expect(result.photoUrl).toBeUndefined();
      expect(result.photoName).toBeUndefined();
      expect(result.phoneNumber).toBe('123');
    });
  });

  describe('fetchBusinessesBySearch', () => {
    it('returns empty array for empty query', async () => {
      const result = await fetchBusinessesBySearch({query: ''});
      expect(result).toEqual([]);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('searches businesses and maps results', async () => {
      const mockResponse = {
        places: [
          {
            id: 'biz_1',
            displayName: {text: 'Vet Clinic A'},
            formattedAddress: '123 Road',
            primaryTypeDisplayName: {text: 'Veterinarian'},
            types: ['veterinary_care', 'point_of_interest'],
          },
        ],
      };
      mockFetchSuccess(mockResponse);

      const result = await fetchBusinessesBySearch({
        query: 'Vet',
        location: {latitude: 10, longitude: 10},
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('places:searchText'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"radius":5000'), // Checks location bias logic
        }),
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'biz_1',
        name: 'Vet Clinic A',
        address: '123 Road',
        primaryType: 'Veterinarian',
        types: ['veterinary_care', 'point_of_interest'],
      });
    });

    it('handles API errors in search', async () => {
      mockFetchError('Quota Exceeded');
      await expect(fetchBusinessesBySearch({query: 'test'})).rejects.toThrow(
        'Quota Exceeded',
      );
    });

    it('handles malformed/empty places list', async () => {
      mockFetchSuccess({}); // No 'places' array
      const result = await fetchBusinessesBySearch({query: 'test'});
      expect(result).toEqual([]);
    });
  });
});