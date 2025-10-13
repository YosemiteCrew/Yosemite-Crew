import {
  fetchPlaceSuggestions,
  fetchPlaceDetails,
} from '@/services/maps/googlePlaces';

// Mock the config
jest.mock('@/config/variables', () => ({
  GOOGLE_PLACES_CONFIG: {
    apiKey: 'test-api-key',
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe('googlePlaces service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('fetchPlaceSuggestions', () => {
    it('should fetch place suggestions successfully', async () => {
      const mockResponse = {
        suggestions: [
          {
            placePrediction: {
              placeId: 'ChIJ1',
              text: {text: '123 Main St'},
              structuredFormat: {
                mainText: {text: '123 Main St'},
                secondaryText: {text: 'San Francisco, CA'},
              },
            },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await fetchPlaceSuggestions({
        query: '123 Main St',
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        placeId: 'ChIJ1',
        primaryText: '123 Main St',
        secondaryText: 'San Francisco, CA',
      });
    });

    it('should return empty array for empty query', async () => {
      const result = await fetchPlaceSuggestions({
        query: '',
      });

      expect(result).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return empty array for whitespace query', async () => {
      const result = await fetchPlaceSuggestions({
        query: '   ',
      });

      expect(result).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should include location in request if provided', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({suggestions: []}),
      });

      await fetchPlaceSuggestions({
        query: 'restaurant',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
        },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"latitude":37.7749'),
        }),
      );
    });

    it('should handle API error response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(
        fetchPlaceSuggestions({query: 'test'}),
      ).rejects.toThrow();
    });

    it('should handle suggestions without structured format', async () => {
      const mockResponse = {
        suggestions: [
          {
            placePrediction: {
              placeId: 'ChIJ2',
              text: {text: '456 Oak Ave'},
            },
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await fetchPlaceSuggestions({
        query: '456 Oak Ave',
      });

      expect(result).toHaveLength(1);
      expect(result[0].primaryText).toBe('456 Oak Ave');
      expect(result[0].secondaryText).toBeUndefined();
    });

    it('should filter out invalid suggestions', async () => {
      const mockResponse = {
        suggestions: [
          {
            placePrediction: {
              placeId: 'ChIJ1',
              text: {text: 'Valid Place'},
            },
          },
          {
            placePrediction: {
              // Missing placeId
              text: {text: 'Invalid Place'},
            },
          },
          {
            // Invalid structure
            someOtherField: 'data',
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await fetchPlaceSuggestions({
        query: 'test',
      });

      expect(result).toHaveLength(1);
      expect(result[0].placeId).toBe('ChIJ1');
    });
  });

  describe('fetchPlaceDetails', () => {
    it('should fetch place details successfully', async () => {
      const mockResponse = {
        formattedAddress: '123 Main St, San Francisco, CA 94102, USA',
        addressComponents: [
          {
            longText: '123',
            types: ['street_number'],
          },
          {
            longText: 'Main St',
            types: ['route'],
          },
          {
            longText: 'San Francisco',
            types: ['locality'],
          },
          {
            longText: 'California',
            types: ['administrative_area_level_1'],
          },
          {
            longText: '94102',
            types: ['postal_code'],
          },
          {
            longText: 'United States',
            types: ['country'],
          },
        ],
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await fetchPlaceDetails('ChIJ1');

      expect(result).toEqual({
        addressLine: '123 Main St',
        city: 'San Francisco',
        stateProvince: 'California',
        postalCode: '94102',
        country: 'United States',
        latitude: 37.7749,
        longitude: -122.4194,
        formattedAddress: '123 Main St, San Francisco, CA 94102, USA',
      });
    });

    it('should handle missing address components', async () => {
      const mockResponse = {
        formattedAddress: 'Some Address',
        addressComponents: [],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await fetchPlaceDetails('ChIJ2');

      expect(result.formattedAddress).toBe('Some Address');
      expect(result.city).toBeUndefined();
      expect(result.stateProvince).toBeUndefined();
    });

    it('should handle API error response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(fetchPlaceDetails('invalid-id')).rejects.toThrow();
    });

    it('should handle missing location data', async () => {
      const mockResponse = {
        formattedAddress: 'Address without coordinates',
        addressComponents: [],
        // No location field
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await fetchPlaceDetails('ChIJ3');

      expect(result.latitude).toBeUndefined();
      expect(result.longitude).toBeUndefined();
    });

    it('should throw when placeId is missing', async () => {
      await expect(fetchPlaceDetails('')).rejects.toThrow(/placeId is required/);
    });

    it('should construct address line from street number and route', async () => {
      const mockResponse = {
        formattedAddress: '789 Pine St, City, State',
        addressComponents: [
          {
            longText: '789',
            types: ['street_number'],
          },
          {
            longText: 'Pine St',
            types: ['route'],
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await fetchPlaceDetails('ChIJ4');

      expect(result.addressLine).toBe('789 Pine St');
    });

    it('should handle route without street number', async () => {
      const mockResponse = {
        formattedAddress: 'Main Street, City',
        addressComponents: [
          {
            longText: 'Main Street',
            types: ['route'],
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await fetchPlaceDetails('ChIJ5');

      expect(result.addressLine).toBe('Main Street');
    });
  });

  describe('API key validation', () => {
    it('should throw error when API key is missing', async () => {
      jest.resetModules();
      jest.doMock('@/config/variables', () => ({
        GOOGLE_PLACES_CONFIG: {
          apiKey: '',
        },
      }));

      const {fetchPlaceSuggestions: fetchSuggestions} = require('@/services/maps/googlePlaces');

      await expect(
        fetchSuggestions({query: 'test'}),
      ).rejects.toThrow('Google Places API key is not configured');
    });
  });
});
