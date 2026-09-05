import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
  type MutableRefObject,
} from 'react';
import {useTranslation} from 'react-i18next';
import {snapToRiskCell} from '@yosemite-crew/types';
import {
  fetchPlaceDetails,
  fetchPlaceSuggestions,
  REGION_PRIMARY_TYPES,
  type PlaceSuggestion,
} from '@/shared/services/maps/googlePlaces';
import LocationService from '@/shared/services/LocationService';
import type {RiskLocation} from '../../types';

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;

interface SearchState {
  query: string;
  suggestions: PlaceSuggestion[];
  searching: boolean;
  resolving: boolean;
  errorKey: string | null;
}

const INITIAL_STATE: SearchState = {
  query: '',
  suggestions: [],
  searching: false,
  resolving: false,
  errorKey: null,
};

type UpdateSearch = Dispatch<Partial<SearchState>>;
type RequestId = MutableRefObject<number>;

const mergeState = (
  state: SearchState,
  update: Partial<SearchState>,
): SearchState => ({...state, ...update});

const useSuggestionSearch = (query: string, update: UpdateSearch) => {
  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      update({suggestions: [], searching: false});
      return;
    }

    let cancelled = false;
    update({searching: true, errorKey: null, suggestions: []});
    const timer = setTimeout(() => {
      fetchPlaceSuggestions({query, includedPrimaryTypes: REGION_PRIMARY_TYPES})
        .then(results => {
          if (!cancelled) update({suggestions: results});
        })
        .catch(() => {
          if (!cancelled) {
            update({suggestions: [], errorKey: 'parasiteRisk.search.error'});
          }
        })
        .finally(() => {
          if (!cancelled) update({searching: false});
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, update]);
};

const usePlaceSelection = (
  requestIdRef: RequestId,
  update: UpdateSearch,
  onSelect: (location: RiskLocation) => void,
  handleClose: () => void,
) =>
  useCallback(
    async (suggestion: PlaceSuggestion) => {
      const requestId = ++requestIdRef.current;
      update({resolving: true, errorKey: null});
      try {
        const details = await fetchPlaceDetails(suggestion.placeId);
        if (requestId !== requestIdRef.current) return;
        if (
          details?.latitude === undefined ||
          details?.longitude === undefined
        ) {
          update({errorKey: 'parasiteRisk.search.unresolved'});
          return;
        }
        onSelect({
          label: details.city ?? suggestion.primaryText,
          lat: details.latitude,
          lon: details.longitude,
          countryCode: details.countryCode,
        });
        handleClose();
      } catch {
        if (requestId === requestIdRef.current) {
          update({errorKey: 'parasiteRisk.search.error'});
        }
      } finally {
        if (requestId === requestIdRef.current) update({resolving: false});
      }
    },
    [handleClose, onSelect, requestIdRef, update],
  );

const useCurrentLocationSelection = (
  requestIdRef: RequestId,
  update: UpdateSearch,
  onSelect: (location: RiskLocation) => void,
  handleClose: () => void,
) => {
  const {t} = useTranslation();
  return useCallback(async () => {
    const requestId = ++requestIdRef.current;
    update({resolving: true, errorKey: null});
    try {
      const coords = await LocationService.getCurrentPosition();
      if (requestId !== requestIdRef.current) return;
      const cell = snapToRiskCell(coords.latitude, coords.longitude);
      onSelect({
        label: t('parasiteRisk.search.currentLocation'),
        lat: cell.lat,
        lon: cell.lon,
      });
      handleClose();
    } catch (error) {
      if (requestId === requestIdRef.current) {
        const denied =
          error instanceof Error &&
          /permission|denied|blocked/i.test(error.message);
        update({
          errorKey: denied
            ? 'parasiteRisk.search.locationDenied'
            : 'parasiteRisk.search.locationUnavailable',
        });
      }
    } finally {
      if (requestId === requestIdRef.current) update({resolving: false});
    }
  }, [handleClose, onSelect, requestIdRef, t, update]);
};

export const useRegionSearchSheet = (
  onClose: () => void,
  onSelect: (location: RiskLocation) => void,
) => {
  const [state, update] = useReducer(mergeState, INITIAL_STATE);
  const requestIdRef = useRef(0);
  const handleClose = useCallback(() => {
    requestIdRef.current += 1;
    update(INITIAL_STATE);
    onClose();
  }, [onClose]);
  const setQuery = useCallback((query: string) => update({query}), []);

  useSuggestionSearch(state.query, update);
  const handleSuggestion = usePlaceSelection(
    requestIdRef,
    update,
    onSelect,
    handleClose,
  );
  const handleUseCurrentLocation = useCurrentLocationSelection(
    requestIdRef,
    update,
    onSelect,
    handleClose,
  );

  return {
    ...state,
    setQuery,
    handleClose,
    handleSuggestion,
    handleUseCurrentLocation,
  };
};
