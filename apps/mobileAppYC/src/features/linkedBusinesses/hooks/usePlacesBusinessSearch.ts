import {useCallback, useEffect, useRef, useState} from 'react';
import {useDispatch} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import {useLocationStore} from '@/shared/stores/locationStore';
import {
  checkOrganisation,
  fetchPlaceCoordinates,
  searchBusinessesByLocation,
} from '../thunks';
import type {BusinessSearchResult} from '../types';

export interface ResolvedBusinessSelection extends BusinessSearchResult {
  placeId: string;
  lat?: number;
  lng?: number;
  organisationId?: string;
  website?: string;
  isPmsOrganisation: boolean;
}

interface UsePlacesBusinessSearchParams {
  onSelectPms: (selection: ResolvedBusinessSelection) => void | Promise<void>;
  onSelectNonPms: (
    selection: ResolvedBusinessSelection,
  ) => void | Promise<void>;
  onError?: (error: unknown) => void;
  location?: {latitude: number; longitude: number} | null;
  useStoredLocation?: boolean;
  minCharacters?: number;
  debounceMs?: number;
}

const hasCoordinates = (lat?: number, lng?: number) =>
  typeof lat === 'number' && typeof lng === 'number';

export const usePlacesBusinessSearch = ({
  onSelectPms,
  onSelectNonPms,
  onError,
  location = null,
  useStoredLocation = true,
  minCharacters = 3,
  debounceMs = 800,
}: UsePlacesBusinessSearchParams) => {
  const dispatch = useDispatch<AppDispatch>();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BusinessSearchResult[]>(
    [],
  );
  const [searching, setSearching] = useState(false);
  const shouldUseStoredLocation =
    useStoredLocation && searchQuery.length >= minCharacters;
  const storedLocation = useLocationStore(shouldUseStoredLocation);
  const searchLocation = useStoredLocation ? storedLocation : location;
  const userLocationRef = useRef(searchLocation);
  userLocationRef.current = searchLocation;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchQueryRef = useRef('');

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearDebounceTimer, [clearDebounceTimer]);

  const clearResults = useCallback(() => {
    setSearchResults([]);
  }, []);

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (query.length < minCharacters) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        setSearchResults([]);
        lastSearchQueryRef.current = '';
        return;
      }

      if (query === lastSearchQueryRef.current) {
        return;
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        if (query === lastSearchQueryRef.current) {
          return;
        }

        setSearching(true);
        try {
          lastSearchQueryRef.current = query;
          const result = await dispatch(
            searchBusinessesByLocation({
              query,
              location: userLocationRef.current,
            }),
          ).unwrap();
          setSearchResults(result);
        } catch (error) {
          console.error('[usePlacesBusinessSearch] Search failed', error);
          onError?.(error);
        } finally {
          setSearching(false);
        }
      }, debounceMs);
    },
    [debounceMs, dispatch, minCharacters, onError],
  );

  const handleSelectBusiness = useCallback(
    async (business: BusinessSearchResult) => {
      setSearchResults([]);
      setSearchQuery(business.name);

      let lat = business.lat;
      let lng = business.lng;

      if (!hasCoordinates(lat, lng)) {
        try {
          const coords = await dispatch(
            fetchPlaceCoordinates(business.id),
          ).unwrap();
          lat = coords.latitude;
          lng = coords.longitude;
        } catch (coordError) {
          console.log(
            '[usePlacesBusinessSearch] Failed to fetch coordinates, skipping PMS check:',
            coordError,
          );
          onError?.(coordError);
          await onSelectNonPms({
            ...business,
            placeId: business.id,
            lat,
            lng,
            isPmsOrganisation: false,
          });
          return;
        }
      }

      try {
        const checkResult = await dispatch(
          checkOrganisation({
            placeId: business.id,
            lat: lat as number,
            lng: lng as number,
            name: business.name,
            addressLine: business.address,
          }),
        ).unwrap();

        const selection: ResolvedBusinessSelection = {
          ...business,
          placeId: business.id,
          lat,
          lng,
          organisationId: checkResult.organisationId,
          phone: checkResult.phone || business.phone,
          email: checkResult.website || business.email,
          website: checkResult.website,
          isPmsOrganisation: Boolean(
            checkResult.isPmsOrganisation && checkResult.organisationId,
          ),
        };

        if (selection.isPmsOrganisation) {
          await onSelectPms(selection);
        } else {
          await onSelectNonPms(selection);
        }
      } catch (error) {
        console.log(
          '[usePlacesBusinessSearch] Organisation check failed, treating as non-PMS:',
          error,
        );
        onError?.(error);
        await onSelectNonPms({
          ...business,
          placeId: business.id,
          lat,
          lng,
          isPmsOrganisation: false,
        });
      }
    },
    [dispatch, onError, onSelectNonPms, onSelectPms],
  );

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    searching,
    handleSearchChange,
    handleSelectBusiness,
    clearResults,
  };
};

export type UsePlacesBusinessSearchReturn = ReturnType<
  typeof usePlacesBusinessSearch
>;
