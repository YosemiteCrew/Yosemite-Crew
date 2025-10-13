import {
  fetchPlaceDetails,
  fetchPlaceSuggestions,
} from '@/services/maps/googlePlaces';

// Mock the config module
jest.mock('@/config/variables', () => ({
  GOOGLE_PLACES_CONFIG: {
    apiKey: 'test-key',
  },
  PASSWORDLESS_AUTH_CONFIG: {
    profileServiceUrl: '',
    createAccountUrl: '',
    profileBootstrapUrl: '',
    googleWebClientId: '',
    facebookAppId: '',
    appleServiceId: '',
    appleRedirectUri: '',
  },
  PENDING_PROFILE_STORAGE_KEY: '@pending_profile_payload',
  PENDING_PROFILE_UPDATED_EVENT: 'pendingProfileUpdated',
}));

declare const global: typeof globalThis & {fetch: jest.Mock};

describe('googlePlaces service', () => {
  beforeAll(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch.mockReset();
  });

  it('throws when API key is missing for suggestions', async () => {
    // Reset modules and mock with empty API key
    jest.resetModules();
    jest.doMock('@/config/variables', () => ({
      GOOGLE_PLACES_CONFIG: {
        apiKey: '',
      },
      PASSWORDLESS_AUTH_CONFIG: {
        profileServiceUrl: '',
        createAccountUrl: '',
        profileBootstrapUrl: '',
        googleWebClientId: '',
        facebookAppId: '',
        appleServiceId: '',
        appleRedirectUri: '',
      },
      PENDING_PROFILE_STORAGE_KEY: '@pending_profile_payload',
      PENDING_PROFILE_UPDATED_EVENT: 'pendingProfileUpdated',
    }));

    const {fetchPlaceSuggestions: fetchSuggestions, MissingApiKeyError: MissingKeyErr} =
      require('@/services/maps/googlePlaces');

    await expect(
      fetchSuggestions({query: '123 Main St'}),
    ).rejects.toBeInstanceOf(MissingKeyErr);

    // Reset back to default mock
    jest.resetModules();
  });

  it('returns normalized suggestion results', async () => {
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
      expect.objectContaining({headers: expect.objectContaining({'X-Goog-Api-Key': 'test-key'})}),
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
