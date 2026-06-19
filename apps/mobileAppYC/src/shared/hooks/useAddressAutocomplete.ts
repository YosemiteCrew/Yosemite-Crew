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
  selectSuggestion: (
    suggestion: PlaceSuggestion,
  ) => Promise<PlaceDetails | null>;
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
  const lastCacheKeyRef = useRef<string>('');

  const trimmedQuery = query.trim();
  const isBelowMinLength = trimmedQuery.length < minQueryLength;
  const locationSignature = location
    ? `${location.latitude?.toFixed(4) ?? ''},${location.longitude?.toFixed(4) ?? ''}`
    : 'none';
  const fetchCacheKey = isBelowMinLength
    ? ''
    : `${trimmedQuery.toLowerCase()}::${locationSignature}`;

  // Inline adjustment 1: when query drops below minQueryLength, immediately reset isFetching.
  const [prevIsBelowMin, setPrevIsBelowMin] = useState(isBelowMinLength);
  // Inline adjustment 2: when a new valid signature appears, immediately set isFetching = true.
  // Initialized to '' so the first above-min query always triggers.
  const [prevFetchCacheKey, setPrevFetchCacheKey] = useState('');

  if (isBelowMinLength !== prevIsBelowMin) {
    setPrevIsBelowMin(isBelowMinLength);
    if (isBelowMinLength) {
      setIsFetching(false);
      lastCacheKeyRef.current = '';
      setPrevFetchCacheKey('');
    }
  }

  if (!isBelowMinLength && fetchCacheKey !== prevFetchCacheKey) {
    setPrevFetchCacheKey(fetchCacheKey);
    if (!skipNextLookupRef.current) {
      setIsFetching(true);
    }
    // When suppressLookup is active: update prevFetchCacheKey to track the new query
    // without changing isFetching — the loading state stays as-is.
  }

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

    const effectTrimmedQuery = query.trim();
    if (effectTrimmedQuery.length < minQueryLength) {
      lastCacheKeyRef.current = '';
      return;
    }

    const effectLocationSig = location
      ? `${location.latitude?.toFixed(4) ?? ''},${location.longitude?.toFixed(4) ?? ''}`
      : 'none';
    const signature = `${effectTrimmedQuery.toLowerCase()}::${effectLocationSig}`;

    if (signature === lastCacheKeyRef.current) {
      return;
    }

    lastCacheKeyRef.current = signature;

    let isActive = true;

    const timeoutId = setTimeout(async () => {
      try {
        const nextSuggestions = await fetchPlaceSuggestions({
          query: effectTrimmedQuery,
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
          setError(
            'Address autocomplete is unavailable. Please enter your address manually.',
          );
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
      lastCacheKeyRef.current = '';
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
          setError(
            'Address autocomplete is unavailable. Please enter your address manually.',
          );
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
    suggestions: isBelowMinLength ? [] : suggestions,
    isFetching,
    error: isBelowMinLength ? null : error,
    clearSuggestions,
    selectSuggestion,
    resetError,
  };
};

export type {PlaceSuggestion} from '@/shared/services/maps/googlePlaces';
