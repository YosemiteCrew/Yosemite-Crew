import {useMemo} from 'react';
import type {Region} from 'react-native-maps';
import type {VetBusiness, BusinessCategory} from '../types';

export interface MapRegionFilterParams {
  businesses: VetBusiness[];
  region: Region | null;
  searchQuery: string;
  category: BusinessCategory | undefined;
  openNow: boolean;
}

const hasCoords = (
  b: VetBusiness,
): b is VetBusiness & {lat: number; lng: number} =>
  b.lat != null && b.lng != null;

const matchesSearch = (business: VetBusiness, query: string): boolean => {
  const q = query.toLowerCase();
  if (business.name.toLowerCase().includes(q)) return true;
  if (business.address?.toLowerCase().includes(q)) return true;
  return business.specialties?.some(s => s.toLowerCase().includes(q)) ?? false;
};

const isInRegion = (lat: number, lng: number, region: Region): boolean => {
  const halfLat = region.latitudeDelta / 2;
  const halfLng = region.longitudeDelta / 2;
  const latInBounds = Math.abs(lat - region.latitude) <= halfLat;
  const lngInBounds = Math.abs(lng - region.longitude) <= halfLng;
  return latInBounds && lngInBounds;
};

const isOpenNow = (business: VetBusiness): boolean =>
  business.openHours?.toLowerCase().startsWith('open') ?? false;

export const useMapRegionFilter = ({
  businesses,
  region,
  searchQuery,
  category,
  openNow,
}: MapRegionFilterParams): VetBusiness[] =>
  useMemo(() => {
    let filtered = businesses.filter(hasCoords);

    if (category) {
      filtered = filtered.filter(b => b.category === category);
    }

    if (openNow) {
      filtered = filtered.filter(isOpenNow);
    }

    if (region) {
      const beforeRegionFilter = filtered;
      const inRegion = filtered.filter(b => isInRegion(b.lat, b.lng, region));
      filtered = inRegion.length > 0 ? inRegion : beforeRegionFilter;
    }

    const trimmed = searchQuery.trim();
    if (trimmed.length >= 2) {
      filtered = filtered.filter(b => matchesSearch(b, trimmed));
    }

    return filtered;
  }, [businesses, region, searchQuery, category, openNow]);
