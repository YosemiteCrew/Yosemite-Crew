import {GOOGLE_PLACES_CONFIG} from '@/config/variables';
import {
  MissingApiKeyError,
  fetchPlaceDetails,
  fetchPlaceSuggestions,
} from '@/services/maps/googlePlaces';

declare const global: typeof globalThis & {fetch: jest.Mock};

describe('googlePlaces service', () => {
  const originalApiKey = GOOGLE_PLACES_CONFIG.apiKey;

  beforeAll(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch.mockReset();
    GOOGLE_PLACES_CONFIG.apiKey = originalApiKey;
  });

  it('throws when API key is missing for suggestions', async () => {
    GOOGLE_PLACES_CONFIG.apiKey = '';

    await expect(
      fetchPlaceSuggestions({query: '123 Main St'}),
    ).rejects.toBeInstanceOf(MissingApiKeyError);
  });

  it('returns normalized suggestion results', async () => {
    GOOGLE_PLACES_CONFIG.apiKey = 'test-key';
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            placePrediction: {
              placeId: 'place-1',
              structuredFormat: {
                mainText: {text: '123 Main St'},
                secondaryText: {text: 'Springfield, USA'},
              },
            },
          },
        ],
      }),
    });

    const results = await fetchPlaceSuggestions({
      query: '123',
      location: {latitude: 1, longitude: 2},
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/places:autocomplete'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({'X-Goog-Api-Key': 'test-key'}),
      }),
    );

    expect(results).toEqual([
      {
        placeId: 'place-1',
        primaryText: '123 Main St',
        secondaryText: 'Springfield, USA',
      },
    ]);
  });

  it('maps place detail fields from API response', async () => {
    GOOGLE_PLACES_CONFIG.apiKey = 'detail-key';
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        formattedAddress: '123 Main St, Springfield, USA',
        addressComponents: [
          {longText: '123', types: ['street_number']},
          {longText: 'Main St', types: ['route']},
          {longText: 'Springfield', types: ['locality']},
          {longText: 'IL', shortText: 'IL', types: ['administrative_area_level_1']},
          {longText: '62704', types: ['postal_code']},
          {longText: 'United States', types: ['country']},
        ],
        location: {
          latitude: 39.7817,
          longitude: -89.6501,
        },
      }),
    });

    const details = await fetchPlaceDetails('place-1');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/places/place-1'),
      expect.objectContaining({headers: expect.objectContaining({'X-Goog-Api-Key': 'detail-key'})}),
    );

    expect(details).toEqual(
      expect.objectContaining({
        addressLine: '123 Main St',
        city: 'Springfield',
        stateProvince: 'IL',
        postalCode: '62704',
        country: 'United States',
        latitude: 39.7817,
        longitude: -89.6501,
      }),
    );
  });
});
