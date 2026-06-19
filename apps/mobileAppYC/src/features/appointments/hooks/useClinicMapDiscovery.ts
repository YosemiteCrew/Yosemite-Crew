import {useState, useMemo, useCallback, useEffect, useRef} from 'react';
import {useSelector} from 'react-redux';
import type {Region} from 'react-native-maps';
import type {RootState} from '@/app/store';
import type {BusinessCategory, VetBusiness} from '../types';
import type {UserCoords} from './useLocationPermission';
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
  pinAndSelectClinic: (business: VetBusiness) => void;
}

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
  initialSelectedId?: string,
  selectionToken?: number,
): ClinicMapDiscoveryState => {
  const reduxBusinesses = useSelector(
    (state: RootState) => state.businesses?.businesses ?? [],
  );

  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const lastAppliedTokenRef = useRef<number | undefined>(undefined);
  const [pinnedClinic, setPinnedClinic] = useState<VetBusiness | null>(null);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [category, setCategory] = useState<BusinessCategory | undefined>(
    undefined,
  );
  const [openNow, setOpenNow] = useState(false);

  const allClinics = useMemo(() => reduxBusinesses, [reduxBusinesses]);

  useEffect(() => {
    if (!initialSelectedId || !selectionToken) return;
    if (lastAppliedTokenRef.current === selectionToken) return;

    const found = allClinics.find(c => c.id === initialSelectedId);
    if (found) {
      lastAppliedTokenRef.current = selectionToken;
      setPinnedClinic(found);
      setSelectedClinicId(initialSelectedId);
    }
  }, [initialSelectedId, selectionToken, allClinics]);

  const allClinicsWithPinned = useMemo(() => {
    if (!pinnedClinic) return allClinics;
    if (allClinics.some(c => c.id === pinnedClinic.id)) return allClinics;
    return [pinnedClinic, ...allClinics];
  }, [allClinics, pinnedClinic]);

  const visibleClinics = useMapRegionFilter({
    businesses: allClinicsWithPinned,
    region: mapRegion,
    searchQuery,
    category,
    openNow,
  });

  const enrichWithDistance = useCallback(
    (userCoords: UserCoords): VetBusiness[] =>
      allClinicsWithPinned.map(clinic =>
        enrichClinicWithDistance(clinic, userCoords),
      ),
    [allClinicsWithPinned],
  );

  const pinAndSelectClinic = useCallback((business: VetBusiness) => {
    setPinnedClinic(business);
    setSelectedClinicId(business.id);
  }, []);

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
    pinAndSelectClinic,
  };
};
