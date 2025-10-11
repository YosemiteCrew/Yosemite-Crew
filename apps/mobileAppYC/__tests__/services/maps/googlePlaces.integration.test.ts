import type {PlaceSuggestion, PlaceDetails} from '@/services/maps/googlePlaces';

const mockFetch = jest.fn();

const loadPlacesModule = (apiKey: string) => {
  jest.resetModules();
  jest.doMock('@/config/variables', () => ({
    GOOGLE_PLACES_CONFIG: {apiKey},
  }));
  let mod: typeof import('@/services/maps/googlePlaces') | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require('@/services/maps/googlePlaces');
  });
  jest.dontMock('@/config/variables');
  if (!mod) {
    throw new Error('Failed to load googlePlaces module');
  }
  return mod;
};

describe('googlePlaces service', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    (global as any).fetch = mockFetch;
  });

  it('throws MissingApiKeyError when API key is absent', async () => {
    const {fetchPlaceSuggestions, MissingApiKeyError} = loadPlacesModule('');
    await expect(
      fetchPlaceSuggestions({query: 'Vet'}),
    ).rejects.toBeInstanceOf(MissingApiKeyError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('normalizes autocomplete suggestions', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        suggestions: [
          {
            placePrediction: {
              placeId: 'abc123',
              structuredFormat: {
                mainText: {text: 'Yosemite Vet'},
                secondaryText: {text: 'San Francisco, CA'},
              },
            },
          },
          {
            placePrediction: {
              placeId: 'missing-main-text',
              text: {text: 'Fallback Text'},
            },
          },
          {
            placePrediction: {
              placeId: undefined,
            },
          },
        ],
      }),
    });

    const {fetchPlaceSuggestions} = loadPlacesModule('test-key');
    const results = await fetchPlaceSuggestions({query: 'Vet'}) as PlaceSuggestion[];

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(results).toEqual([
      {
        placeId: 'abc123',
        primaryText: 'Yosemite Vet',
        secondaryText: 'San Francisco, CA',
      },
      {
        placeId: 'missing-main-text',
        primaryText: 'Fallback Text',
        secondaryText: undefined,
      },
    ]);
  });

  it('propagates server error messages for suggestions', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      text: jest.fn().mockResolvedValue('quota exceeded'),
    });

    const {fetchPlaceSuggestions} = loadPlacesModule('another-key');

    await expect(
      fetchPlaceSuggestions({query: 'Vet'}),
    ).rejects.toThrow('quota exceeded');
  });

  it('returns structured place details', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        formattedAddress: '1234 Market St, San Francisco, CA 94103, USA',
        addressComponents: [
          {longText: '1234', types: ['street_number']},
          {longText: 'Market St', types: ['route']},
          {longText: 'Suite 200', types: ['subpremise']},
          {longText: 'San Francisco', types: ['locality']},
          {shortText: 'CA', types: ['administrative_area_level_1']},
          {longText: '94103', types: ['postal_code']},
          {longText: 'United States', types: ['country']},
        ],
        location: {latitude: 37.7749, longitude: -122.4194},
      }),
    });

    const {fetchPlaceDetails} = loadPlacesModule('details-key');
    const result = await fetchPlaceDetails('place-id') as PlaceDetails;

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('place-id'),
      expect.objectContaining({method: 'GET'}),
    );
    expect(result).toMatchObject({
      addressLine: 'Suite 200/ 1234 Market St',
      city: 'San Francisco',
      stateProvince: 'CA',
      postalCode: '94103',
      country: 'United States',
      latitude: 37.7749,
      longitude: -122.4194,
    });
  });
});
