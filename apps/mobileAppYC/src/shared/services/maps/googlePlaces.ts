import {GOOGLE_PLACES_CONFIG} from '@/config/variables';

const GOOGLE_PLACES_BASE_URL = 'https://places.googleapis.com/v1';

export interface PlaceSuggestion {
  placeId: string;
  primaryText: string;
  secondaryText?: string;
}

export interface FetchPlaceSuggestionsParams {
  query: string;
  location?: {
    latitude: number;
    longitude: number;
  } | null;
}

export interface PlaceDetails {
  addressLine?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
  photoUrl?: string | null;
  phoneNumber?: string | null;
  website?: string | null;
}

export interface BusinessSearchResult {
  id: string;
  name: string;
  address: string;
  primaryType?: string;
  types?: string[];
}

export interface FetchBusinessSearchParams {
  query: string;
  location?: {
    latitude: number;
    longitude: number;
  } | null;
}

class MissingApiKeyError extends Error {
  constructor() {
    super('Google Places API key is not configured.');
    this.name = 'MissingApiKeyError';
  }
}

const ensureApiKey = () => {
  const key = GOOGLE_PLACES_CONFIG.apiKey?.trim();
  if (!key) {
    throw new MissingApiKeyError();
  }
  return key;
};

const buildFieldMask = (fields: string[]) => fields.join(',');

const normalizeSuggestion = (raw: any): PlaceSuggestion | null => {
  const placePrediction = raw?.placePrediction;
  const placeId: string | undefined = placePrediction?.placeId;
  if (!placeId) {
    return null;
  }

  const structuredFormat = placePrediction?.structuredFormat;
  const primaryText: string | undefined =
    structuredFormat?.mainText?.text ?? placePrediction?.text?.text;
  const secondaryText: string | undefined = structuredFormat?.secondaryText?.text;

  return {
    placeId,
    primaryText: primaryText ?? placeId,
    secondaryText,
  };
};

const findAddressComponent = (components: any[], type: string) =>
  components.find((component: any) =>
    Array.isArray(component?.types) && component.types.includes(type),
  );

export const fetchPlaceSuggestions = async ({
  query,
  location,
}: FetchPlaceSuggestionsParams): Promise<PlaceSuggestion[]> => {
  const apiKey = ensureApiKey();

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const response = await fetch(`${GOOGLE_PLACES_BASE_URL}/places:autocomplete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': buildFieldMask([
        'suggestions.placePrediction.placeId',
        'suggestions.placePrediction.text',
        'suggestions.placePrediction.structuredFormat',
      ]),
    },
    body: JSON.stringify({
      input: trimmedQuery,
      includedPrimaryTypes: ['street_address', 'premise', 'route'],
      locationBias: location
        ? {
            circle: {
              center: {
                latitude: location.latitude,
                longitude: location.longitude,
              },
              radius: 3000,
            },
          }
        : undefined,
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(
      message || 'Failed to fetch address suggestions from Google Places.',
    );
  }

  const payload = await response.json().catch(() => ({}));
  const suggestions = Array.isArray(payload?.suggestions)
    ? (payload.suggestions as any[])
    : [];

  return suggestions
    .map(normalizeSuggestion)
    .filter((item): item is PlaceSuggestion => Boolean(item?.primaryText));
};

export const fetchPlaceDetails = async (placeId: string): Promise<PlaceDetails> => {
  const apiKey = ensureApiKey();
  if (!placeId) {
    throw new Error('A valid placeId is required to fetch place details.');
  }

  const response = await fetch(
    `${GOOGLE_PLACES_BASE_URL}/places/${encodeURIComponent(placeId)}?languageCode=en`,
    {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': buildFieldMask([
          'formattedAddress',
          'addressComponents',
          'location',
          'displayName',
          'photos',
        ]),
      },
    },
  );

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(message || 'Failed to fetch place details from Google Places.');
  }

  const payload = await response.json().catch(() => ({}));
  const addressComponents = Array.isArray(payload?.addressComponents)
    ? payload.addressComponents
    : [];

  const formattedAddress: string | undefined = payload?.formattedAddress;
  const streetNumber = findAddressComponent(addressComponents, 'street_number')?.longText;
  const route = findAddressComponent(addressComponents, 'route')?.longText;
  const subpremise = findAddressComponent(addressComponents, 'subpremise')?.longText;
  const locality =
    findAddressComponent(addressComponents, 'locality')?.longText ??
    findAddressComponent(addressComponents, 'postal_town')?.longText ??
    findAddressComponent(addressComponents, 'sublocality')?.longText;
  const stateProvince = findAddressComponent(addressComponents, 'administrative_area_level_1')?.shortText ??
    findAddressComponent(addressComponents, 'administrative_area_level_1')?.longText;
  const postalCode = findAddressComponent(addressComponents, 'postal_code')?.longText;
  const country = findAddressComponent(addressComponents, 'country')?.longText;

  const addressLineParts = [
    subpremise ? `${subpremise}/` : undefined,
    streetNumber,
    route,
  ].filter(Boolean);

  const addressLine = addressLineParts.join(' ').replaceAll(/\s+/g, ' ').trim();

  return {
    addressLine: addressLine || formattedAddress,
    city: locality,
    stateProvince,
    postalCode,
    country,
    latitude: payload?.location?.latitude,
    longitude: payload?.location?.longitude,
    formattedAddress,
  };
};

/**
 * Fetch detailed business information for linked businesses
 * Includes photo, phone number, and website from Google Places
 */
export const fetchBusinessPlaceDetails = async (placeId: string): Promise<PlaceDetails> => {
  const apiKey = ensureApiKey();
  if (!placeId) {
    throw new Error('A valid placeId is required to fetch place details.');
  }

  const response = await fetch(
    `${GOOGLE_PLACES_BASE_URL}/places/${encodeURIComponent(placeId)}?languageCode=en`,
    {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': buildFieldMask([
          'photos',
          'nationalPhoneNumber',
          'internationalPhoneNumber',
          'websiteUri',
        ]),
      },
    },
  );

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(message || 'Failed to fetch business details from Google Places.');
  }

  const payload = await response.json().catch(() => ({}));

  // Extract first photo URL from Google Places API response
  // The photos array contains objects with 'name' field that is the photo resource name
  // We need to construct the proper photo URL using the name
  const photos = Array.isArray(payload?.photos) ? payload.photos : [];
  let photoUrl: string | undefined;

  if (photos.length > 0) {
    const photoName = photos[0]?.name;
    if (photoName) {
      // Construct the proper photo URL with media endpoint
      photoUrl = `${GOOGLE_PLACES_BASE_URL}/${photoName}/media?key=${apiKey}&max_height_px=400&max_width_px=400`;
    }
  }

  // Get phone number and website
  const phoneNumber = payload?.nationalPhoneNumber || payload?.internationalPhoneNumber;
  const website = payload?.websiteUri;

  return {
    photoUrl,
    phoneNumber,
    website,
    formattedAddress: undefined,
  };
};

/**
 * Fetch businesses using Text Search (New) API
 * Used for searching actual businesses (hospitals, groomers, breeders, boarders, etc.)
 * Returns actual business results, not address suggestions
 */
export const fetchBusinessesBySearch = async ({
  query,
  location,
}: FetchBusinessSearchParams): Promise<BusinessSearchResult[]> => {
  const apiKey = ensureApiKey();

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const response = await fetch(`${GOOGLE_PLACES_BASE_URL}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': buildFieldMask([
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.primaryTypeDisplayName',
        'places.types',
      ]),
    },
    body: JSON.stringify({
      textQuery: trimmedQuery,
      maxResultCount: 10,
      locationBias: location
        ? {
            circle: {
              center: {
                latitude: location.latitude,
                longitude: location.longitude,
              },
              radius: 5000, // 5km radius for better business discovery
            },
          }
        : undefined,
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(
      message || 'Failed to fetch business results from Google Places.',
    );
  }

  const payload = await response.json().catch(() => ({}));
  const places = Array.isArray(payload?.places) ? (payload.places as any[]) : [];

  return places.map((place: any) => ({
    id: place.id,
    name: place.displayName?.text || '',
    address: place.formattedAddress || '',
    primaryType: place.primaryTypeDisplayName?.text || '',
    types: place.types || [],
  }));
};

export {MissingApiKeyError};
