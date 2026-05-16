import {useState, useMemo, useCallback} from 'react';
import {useSelector} from 'react-redux';
import type {Region} from 'react-native-maps';
import type {RootState} from '@/app/store';
import type {BusinessCategory, VetBusiness} from '../types';
import type {UserCoords} from './useLocationPermission';
import {MOCK_CLINICS} from '../mocks/clinicMocks';
import {useMapRegionFilter} from './useMapRegionFilter';
import {calculateDistanceKm, kmToMi} from '../utils/distanceCalc';

export interface ClinicMapDiscoveryState {
  visibleClinics: VetBusiness[];
  selectedClinicId: string | null;
  mapRegion: Region | null;
  category: BusinessCategory | undefined;
  openNow: boolean;
  setSelectedClinicId: (id: string | null) => void;
  setMapRegion: (region: Region) => void;
  setCategory: (c: BusinessCategory | undefined) => void;
  setOpenNow: (v: boolean) => void;
  enrichWithDistance: (userCoords: UserCoords) => VetBusiness[];
}

const mergeAndDeduplicate = (
  redux: VetBusiness[],
  mocks: VetBusiness[],
): VetBusiness[] => {
  const knownIds = new Set(redux.map(b => b.id));
  const uniqueMocks = mocks.filter(m => !knownIds.has(m.id));
  return [...redux, ...uniqueMocks];
};

const enrichClinicWithDistance = (
  clinic: VetBusiness,
  userCoords: UserCoords,
): VetBusiness => {
  if (clinic.lat == null || clinic.lng == null) return clinic;
  const distKm = calculateDistanceKm(userCoords, {
    lat: clinic.lat,
    lng: clinic.lng,
  });
  return {...clinic, distanceMi: kmToMi(distKm), distanceMeters: distKm * 1000};
};

export const useClinicMapDiscovery = (
  searchQuery: string,
): ClinicMapDiscoveryState => {
  const reduxBusinesses = useSelector(
    (state: RootState) => state.businesses?.businesses ?? [],
  );

  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [category, setCategory] = useState<BusinessCategory | undefined>(
    undefined,
  );
  const [openNow, setOpenNow] = useState(false);

  const allClinics = useMemo(
    () => mergeAndDeduplicate(reduxBusinesses, MOCK_CLINICS),
    [reduxBusinesses],
  );

  const visibleClinics = useMapRegionFilter({
    businesses: allClinics,
    region: mapRegion,
    searchQuery,
    category,
    openNow,
  });

  const enrichWithDistance = useCallback(
    (userCoords: UserCoords): VetBusiness[] =>
      allClinics.map(clinic => enrichClinicWithDistance(clinic, userCoords)),
    [allClinics],
  );

  return {
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
  };
};
