import {GOOGLE_PLACES_CONFIG} from '@/config/variablesExample';
import {
  fetchPlaceSuggestions,
  fetchPlaceDetails,
  MissingApiKeyError,
} from '@/services/maps/googlePlaces';

declare const global: typeof globalThis & {fetch: jest.Mock};

describe('googlePlaces integration-edge cases', () => {
  const originalApiKey = GOOGLE_PLACES_CONFIG.apiKey;

  beforeAll(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch.mockReset();
    GOOGLE_PLACES_CONFIG.apiKey = originalApiKey;
  });

  it('returns empty suggestions for blank query', async () => {
    GOOGLE_PLACES_CONFIG.apiKey = 'key';
    const results = await fetchPlaceSuggestions({query: '   ', location: null});
    expect(results).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('filters out invalid suggestions without placeId', async () => {
    GOOGLE_PLACES_CONFIG.apiKey = 'key';
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
    GOOGLE_PLACES_CONFIG.apiKey = 'key';
    global.fetch.mockResolvedValue({ ok: false, text: async () => 'Bad Request' });
    await expect(fetchPlaceSuggestions({query: 'Main'})).rejects.toThrow('Bad Request');
  });

  it('throws when fetching details without placeId', async () => {
    await expect(fetchPlaceDetails('')).rejects.toThrow(/placeId is required/);
  });

  it('returns formattedAddress as addressLine when components missing', async () => {
    GOOGLE_PLACES_CONFIG.apiKey = 'key';
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
    GOOGLE_PLACES_CONFIG.apiKey = 'key';
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
    GOOGLE_PLACES_CONFIG.apiKey = '';
    await expect(fetchPlaceSuggestions({query: 'q'})).rejects.toBeInstanceOf(MissingApiKeyError);
  });

  it('throws details error with server text', async () => {
    GOOGLE_PLACES_CONFIG.apiKey = 'k';
    global.fetch.mockResolvedValue({ ok: false, text: async () => 'Not Found' });
    await expect(fetchPlaceDetails('pid')).rejects.toThrow('Not Found');
  });
});

