import {
  fetchPlaceSuggestions,
  fetchPlaceDetails,
} from '@/shared/services/maps/googlePlaces';

// Mock the config module
jest.mock('@/config/variables', () => ({
  GOOGLE_PLACES_CONFIG: {
    apiKey: 'key',
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

describe('googlePlaces integration-edge cases', () => {
  beforeAll(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch.mockReset();
  });

  it('returns empty suggestions for blank query', async () => {
    const results = await fetchPlaceSuggestions({query: '   ', location: null});
    expect(results).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('filters out invalid suggestions without placeId', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestions: [
          {placePrediction: {text: {text: 'No ID'}}},
          {placePrediction: {placeId: 'p1', text: {text: 'Main'}, structuredFormat: {mainText: {text: 'Main'}}}},
        ],
      }),
    });
    const results = await fetchPlaceSuggestions({query: 'Main'});
    expect(results).toHaveLength(1);
    expect(results[0].placeId).toBe('p1');
  });

  it('throws with server message on suggestions error', async () => {
    global.fetch.mockResolvedValue({ ok: false, text: async () => 'Bad Request' });
    await expect(fetchPlaceSuggestions({query: 'Main'})).rejects.toThrow('Bad Request');
  });

  it('throws when fetching details without placeId', async () => {
    await expect(fetchPlaceDetails('')).rejects.toThrow(/placeId is required/);
  });

  it('returns formattedAddress as addressLine when components missing', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        formattedAddress: 'Fallback Address, City, Country',
        addressComponents: [],
        location: {latitude: 1, longitude: 2},
      }),
    });
    const details = await fetchPlaceDetails('pid');
    expect(details.addressLine).toBe('Fallback Address, City, Country');
    expect(details.latitude).toBe(1);
  });

  it('uses postal_town or sublocality as city and longText for state', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        formattedAddress: 'Z',
        addressComponents: [
          {longText: 'Route 1', types: ['route']},
          {longText: 'Townsville', types: ['postal_town']},
          {longText: 'California', types: ['administrative_area_level_1']},
          {longText: '99999', types: ['postal_code']},
          {longText: 'USA', types: ['country']},
        ],
        location: {},
      }),
    });
    const details = await fetchPlaceDetails('pid');
    expect(details.city).toBe('Townsville');
    expect(details.stateProvince).toBe('California');
  });

  it('throws suggestions when API key missing', async () => {
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
      require('@/shared/services/maps/googlePlaces');

    await expect(fetchSuggestions({query: 'q'})).rejects.toBeInstanceOf(MissingKeyErr);

    // Reset back to default mock
    jest.resetModules();
  });

  it('throws details error with server text', async () => {
    global.fetch.mockResolvedValue({ ok: false, text: async () => 'Not Found' });
    await expect(fetchPlaceDetails('pid')).rejects.toThrow('Not Found');
  });
});

