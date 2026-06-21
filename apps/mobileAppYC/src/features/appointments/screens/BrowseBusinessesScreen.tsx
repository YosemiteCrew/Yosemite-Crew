import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, StyleSheet, View} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {
  NavigationProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {Region} from 'react-native-maps';

import type {AppDispatch, RootState} from '@/app/store';
import {useTheme} from '@/hooks';
import {usePreferences} from '@/features/preferences/PreferencesContext';
import {
  fetchBusinesses,
  upsertBusiness,
} from '@/features/appointments/businessesSlice';
import {
  selectCompanions,
  selectSelectedCompanionId,
} from '@/features/companion';
import {
  fetchBusinessDetails,
  fetchGooglePlacesImage,
} from '@/features/linkedBusinesses';
import {
  usePlacesBusinessSearch,
  type ResolvedBusinessSelection,
} from '@/features/linkedBusinesses/hooks/usePlacesBusinessSearch';
import {mapSelectionToVetBusiness} from '@/features/linkedBusinesses/utils/mapSelectionToVetBusiness';
import {BusinessSearchDropdown} from '@/features/linkedBusinesses/components/BusinessSearchDropdown';
import {isDummyPhoto} from '@/features/appointments/utils/photoUtils';
import type {AppointmentStackParamList, TabParamList} from '@/navigation/types';
import type {VetBusiness} from '../types';

import MapDiscoveryView from '../components/MapDiscovery/MapDiscoveryView';
import {useLocationPermission} from '../hooks/useLocationPermission';
import {useClinicMapDiscovery} from '../hooks/useClinicMapDiscovery';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

type Fallbacks = Record<
  string,
  {photo?: string | null; phone?: string; website?: string}
>;

const MIN_SEARCH_INTERVAL_MS = 1000;

const buildDropdownTop = (theme: any): number => theme.spacing['30'];

const needsPhotoFetch = (biz: VetBusiness): boolean =>
  Boolean((!biz.photo || isDummyPhoto(biz.photo)) && biz.googlePlacesId);

const needsContactFetch = (biz: VetBusiness): boolean =>
  Boolean((!biz.phone || !biz.website) && biz.googlePlacesId);

const resolveTargetCompanionId = (
  selectedId: string | null,
  companions: any[],
): string | null =>
  selectedId ??
  companions[0]?.id ??
  companions[0]?._id ??
  companions[0]?.identifier?.[0]?.value ??
  null;

export const BrowseBusinessesScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<Nav>();
  const route =
    useRoute<RouteProp<AppointmentStackParamList, 'BrowseBusinesses'>>();
  const {distanceUnit} = usePreferences();
  const {
    userLocation,
    userCoords,
    hasPermission,
    isLoading: locationLoading,
  } = useLocationPermission();
  const initialQuery = route.params?.serviceName ?? '';
  const initialBusinessId = route.params?.initialBusinessId;
  const selectionToken = route.params?.selectionToken;
  const lastSearchRef = useRef<number>(0);
  const lastTermRef = useRef<string>('');
  const pinAndSelectClinicRef = useRef<(b: VetBusiness) => void>(() => {});
  const clearResultsRef = useRef<() => void>(() => {});
  const companions = useSelector(selectCompanions);
  const selectedCompanionId = useSelector(selectSelectedCompanionId);
  const targetCompanionId = useMemo(
    () => resolveTargetCompanionId(selectedCompanionId, companions),
    [companions, selectedCompanionId],
  );
  const selectedCompanion = useMemo(
    () =>
      targetCompanionId
        ? (companions.find(c => c.id === targetCompanionId) ?? null)
        : (companions[0] ?? null),
    [companions, targetCompanionId],
  );
  const [fallbacks, setFallbacks] = useState<Fallbacks>({});
  const requestedDetailsRef = useRef<Set<string>>(new Set());
  const requestBusinessDetails = useCallback(
    async (biz: VetBusiness) => {
      const placeId = biz.googlePlacesId;
      if (!placeId || requestedDetailsRef.current.has(placeId)) return;
      requestedDetailsRef.current.add(placeId);

      try {
        const result = await dispatch(fetchBusinessDetails(placeId)).unwrap();
        setFallbacks(prev => ({
          ...prev,
          [biz.id]: {
            photo: result.photoUrl ?? prev[biz.id]?.photo ?? null,
            phone: result.phoneNumber ?? prev[biz.id]?.phone,
            website: result.website ?? prev[biz.id]?.website,
          },
        }));
        return;
      } catch {}

      try {
        const img = await dispatch(fetchGooglePlacesImage(placeId)).unwrap();
        if (img.photoUrl) {
          setFallbacks(prev => ({
            ...prev,
            [biz.id]: {...prev[biz.id], photo: img.photoUrl},
          }));
        }
      } catch {}
    },
    [dispatch],
  );
  const ensureCompanion = useCallback(() => {
    if (targetCompanionId && selectedCompanion) return true;
    Alert.alert('Add a companion', 'Add a companion to notify a business.');
    return false;
  }, [selectedCompanion, targetCompanionId]);

  const handlePmsSelection = useCallback(
    async (selection: ResolvedBusinessSelection) => {
      const payload = mapSelectionToVetBusiness(selection);
      dispatch(upsertBusiness(payload));
      pinAndSelectClinicRef.current(payload);
      clearResultsRef.current();
    },
    [dispatch],
  );

  const handleNonPmsSelection = useCallback(
    async (selection: ResolvedBusinessSelection) => {
      if (!ensureCompanion() || !targetCompanionId || !selectedCompanion)
        return;
      navigation
        .getParent<NavigationProp<TabParamList>>()
        ?.navigate('HomeStack', {
          screen: 'LinkedBusinesses',
          params: {
            screen: 'BusinessAdd',
            params: {
              companionId: targetCompanionId,
              companionName: selectedCompanion.name,
              companionBreed: selectedCompanion.breed?.breedName,
              companionImage: selectedCompanion.profileImage ?? undefined,
              category: 'hospital',
              businessId: selection.placeId,
              businessName: selection.name,
              businessAddress: selection.address,
              phone: selection.phone,
              email: selection.email,
              photo: selection.photo,
              isPMSRecord: false,
              rating: selection.rating,
              distance: selection.distance,
              placeId: selection.placeId,
              returnTo: {tab: 'Appointments', screen: 'BrowseBusinesses'},
            },
          },
        });
    },
    [ensureCompanion, navigation, selectedCompanion, targetCompanionId],
  );

  const handleSearchError = useCallback((error: unknown) => {
    console.log('[BrowseBusinesses] Places search error', error);
  }, []);

  const placesSearch = usePlacesBusinessSearch({
    onSelectPms: handlePmsSelection,
    onSelectNonPms: handleNonPmsSelection,
    onError: handleSearchError,
  });
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    searching,
    handleSearchChange,
    handleSelectBusiness,
    clearResults,
  } = placesSearch;
  const performSearch = useCallback(
    (term?: string) => {
      const trimmed = (term ?? searchQuery).trim();
      const now = Date.now();
      if (
        trimmed === lastTermRef.current &&
        now - lastSearchRef.current < MIN_SEARCH_INTERVAL_MS
      ) {
        return;
      }
      lastTermRef.current = trimmed;
      lastSearchRef.current = now;
      const coords = userCoords
        ? {lat: userCoords.lat, lng: userCoords.lng}
        : undefined;
      dispatch(
        fetchBusinesses(trimmed ? {serviceName: trimmed, ...coords} : coords),
      );
    },
    [dispatch, searchQuery, userCoords],
  );
  const {
    visibleClinics,
    selectedClinicId,
    mapRegion,
    category,
    openNow,
    setSelectedClinicId,
    setMapRegion,
    setCategory,
    setOpenNow,
    enrichWithDistance,
    pinAndSelectClinic,
  } = useClinicMapDiscovery(searchQuery, initialBusinessId, selectionToken);

  clearResultsRef.current = clearResults;
  pinAndSelectClinicRef.current = pinAndSelectClinic;

  const enrichedClinics = useMemo(() => {
    if (userCoords == null) return visibleClinics;
    return enrichWithDistance(userCoords);
  }, [enrichWithDistance, userCoords, visibleClinics]);
  const hasInitialSearched = useRef(false);
  const hasLocationSearched = useRef(false);
  const prevPermissionRef = useRef<boolean | null>(null);

  useEffect(() => {
    setSearchQuery(initialQuery);
  }, [initialQuery, setSearchQuery]);

  useEffect(() => {
    if (locationLoading || hasInitialSearched.current) return;
    hasInitialSearched.current = true;
    performSearch(initialQuery);
  }, [locationLoading, initialQuery, performSearch]);

  useEffect(() => {
    if (!userLocation || hasLocationSearched.current) return;
    hasLocationSearched.current = true;
    performSearch(initialQuery);
  }, [userLocation, initialQuery, performSearch]);

  // Re-search when location permission is toggled at runtime (via device Settings)
  useEffect(() => {
    if (locationLoading) return;
    const changed =
      prevPermissionRef.current !== null &&
      prevPermissionRef.current !== hasPermission;
    prevPermissionRef.current = hasPermission;
    if (!changed) return;
    hasLocationSearched.current = false;
    performSearch(initialQuery);
  }, [hasPermission, locationLoading, initialQuery, performSearch]);

  const reduxBusinesses = useSelector(
    (state: RootState) => state.businesses?.businesses ?? [],
  );
  useEffect(() => {
    reduxBusinesses.forEach(biz => {
      if (needsPhotoFetch(biz) || needsContactFetch(biz)) {
        requestBusinessDetails(biz);
      }
    });
  }, [reduxBusinesses, requestBusinessDetails]);

  const handleUnifiedSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      handleSearchChange(text);
    },
    [setSearchQuery, handleSearchChange],
  );

  const handleSearchSubmit = useCallback(() => {
    performSearch(searchQuery);
    handleSearchChange(searchQuery);
  }, [performSearch, searchQuery, handleSearchChange]);

  const handleRegionChange = useCallback(
    (region: Region) => setMapRegion(region),
    [setMapRegion],
  );

  const [headerHeight, setHeaderHeight] = useState(0);

  const showSearchResults =
    searchQuery.length >= 2 && searchResults.length > 0 && !searching;

  const dropdownTop =
    headerHeight > 0
      ? headerHeight + theme.spacing['2']
      : buildDropdownTop(theme) + theme.spacing['2'];

  const searchResultsOverlay = showSearchResults ? (
    <BusinessSearchDropdown
      visible
      top={dropdownTop}
      items={searchResults}
      onSelect={handleSelectBusiness}
      onDismiss={clearResults}
    />
  ) : null;

  return (
    <View style={styles.root}>
      <MapDiscoveryView
        clinics={enrichedClinics.filter(c =>
          visibleClinics.some(v => v.id === c.id),
        )}
        selectedClinicId={selectedClinicId}
        userLocation={userLocation}
        hasLocationPermission={hasPermission}
        searchQuery={searchQuery}
        category={category}
        openNow={openNow}
        mapRegion={mapRegion}
        fallbacks={fallbacks}
        distanceUnit={distanceUnit}
        navigation={navigation}
        onRegionChange={handleRegionChange}
        onSelectClinic={setSelectedClinicId}
        onSearchChange={handleUnifiedSearchChange}
        onSearchSubmit={handleSearchSubmit}
        onCategoryChange={setCategory}
        onOpenNowChange={setOpenNow}
        onBack={() => navigation.goBack()}
        searchResultsOverlay={searchResultsOverlay}
        onSearchBarLayout={setHeaderHeight}
      />
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
  });

export default BrowseBusinessesScreen;
