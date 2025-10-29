import {useCallback, useEffect, useRef, useState} from 'react';
import {
  fetchPlaceDetails,
  fetchPlaceSuggestions,
  MissingApiKeyError,
  type FetchPlaceSuggestionsParams,
  type PlaceDetails,
  type PlaceSuggestion,
} from '@/shared/services/maps/googlePlaces';

interface UseAddressAutocompleteOptions {
  initialQuery?: string;
  minQueryLength?: number;
  debounceMs?: number;
  location?: FetchPlaceSuggestionsParams['location'];
}

interface SetQueryOptions {
  suppressLookup?: boolean;
}

interface UseAddressAutocompleteResult {
  query: string;
  setQuery: (value: string, options?: SetQueryOptions) => void;
  suggestions: PlaceSuggestion[];
  isFetching: boolean;
  error: string | null;
  clearSuggestions: () => void;
  selectSuggestion: (suggestion: PlaceSuggestion) => Promise<PlaceDetails | null>;
  resetError: () => void;
}

const DEFAULT_MIN_QUERY_LENGTH = 3;
const DEFAULT_DEBOUNCE_MS = 350;

export const useAddressAutocomplete = ({
  initialQuery = '',
  minQueryLength = DEFAULT_MIN_QUERY_LENGTH,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  location,
}: UseAddressAutocompleteOptions = {}): UseAddressAutocompleteResult => {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skipNextLookupRef = useRef(false);
  const lastSignatureRef = useRef<string>('');

  const setQueryWithOptions = useCallback(
    (value: string, options?: SetQueryOptions) => {
      if (options?.suppressLookup) {
        skipNextLookupRef.current = true;
      }
      setQuery(value);
    },
    [],
  );

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (skipNextLookupRef.current) {
      skipNextLookupRef.current = false;
      return;
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < minQueryLength) {
      setSuggestions([]);
      setError(null);
      lastSignatureRef.current = '';
      return;
    }

    const locationSignature = location
      ? `${location.latitude?.toFixed(4) ?? ''},${location.longitude?.toFixed(4) ?? ''}`
      : 'none';
    const signature = `${trimmedQuery.toLowerCase()}::${locationSignature}`;

    if (signature === lastSignatureRef.current) {
      return;
    }

    lastSignatureRef.current = signature;

    let isActive = true;
    setIsFetching(true);

    const timeoutId = setTimeout(async () => {
      try {
        const nextSuggestions = await fetchPlaceSuggestions({
          query: trimmedQuery,
          location,
        });
        if (!isActive) {
          return;
        }
        setSuggestions(nextSuggestions);
        setError(null);
      } catch (fetchError) {
        if (!isActive) {
          return;
        }
        if (fetchError instanceof MissingApiKeyError) {
          setError('Address autocomplete is unavailable. Please enter your address manually.');
        } else {
          setError('Unable to fetch address suggestions.');
        }
        setSuggestions([]);
      } finally {
        if (isActive) {
          setIsFetching(false);
        }
      }
    }, debounceMs);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [query, minQueryLength, debounceMs, location]);

  const selectSuggestion = useCallback(
    async (suggestion: PlaceSuggestion): Promise<PlaceDetails | null> => {
      skipNextLookupRef.current = true;
      lastSignatureRef.current = '';
      setIsFetching(true);
      try {
        const details = await fetchPlaceDetails(suggestion.placeId);
        const addressLine = details.addressLine ?? suggestion.primaryText;
        setQuery(addressLine ?? '');
        setSuggestions([]);
        setError(null);
        return {
          ...details,
          addressLine: addressLine ?? undefined,
        };
      } catch (fetchError) {
        if (fetchError instanceof MissingApiKeyError) {
          setError('Address autocomplete is unavailable. Please enter your address manually.');
        } else {
          setError('Unable to fetch the selected address details.');
        }
        return null;
      } finally {
        setIsFetching(false);
      }
    },
    [],
  );

  return {
    query,
    setQuery: setQueryWithOptions,
    suggestions,
    isFetching,
    error,
    clearSuggestions,
    selectSuggestion,
    resetError,
  };
};

export type {PlaceSuggestion} from '@/shared/services/maps/googlePlaces';
