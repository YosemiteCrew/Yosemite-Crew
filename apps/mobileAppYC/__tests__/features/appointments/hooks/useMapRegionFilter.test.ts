import {renderHook} from '@testing-library/react-native';
import {useMapRegionFilter} from '../../../../src/features/appointments/hooks/useMapRegionFilter';
import type {VetBusiness} from '../../../../src/features/appointments/types';
import type {Region} from 'react-native-maps';

const makeClinic = (overrides: Partial<VetBusiness> = {}): VetBusiness => ({
  id: 'clinic_1',
  name: 'Test Clinic',
  category: 'hospital',
  address: '100 Main St',
  lat: 37.77,
  lng: -122.42,
  rating: 4.5,
  specialties: ['Internal Medicine'],
  ...overrides,
});

const SF_REGION: Region = {
  latitude: 37.77,
  longitude: -122.42,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

describe('useMapRegionFilter', () => {
  describe('coordinate filtering', () => {
    it('excludes clinics without lat/lng', () => {
      const clinics = [makeClinic({id: 'a', lat: undefined, lng: undefined})];
      const {result} = renderHook(() =>
        useMapRegionFilter({
          businesses: clinics,
          region: null,
          searchQuery: '',
          category: undefined,
        }),
      );
      expect(result.current).toHaveLength(0);
    });

    it('excludes clinics with lat but no lng', () => {
      const clinics = [makeClinic({id: 'a', lat: 37.77, lng: undefined})];
      const {result} = renderHook(() =>
        useMapRegionFilter({
          businesses: clinics,
          region: null,
          searchQuery: '',
          category: undefined,
        }),
      );
      expect(result.current).toHaveLength(0);
    });

    it('includes clinics with both lat and lng', () => {
      const clinics = [makeClinic({id: 'a'})];
      const {result} = renderHook(() =>
        useMapRegionFilter({
          businesses: clinics,
          region: null,
          searchQuery: '',
          category: undefined,
        }),
      );
      expect(result.current).toHaveLength(1);
    });
  });

  describe('region filtering', () => {
    it('includes clinics inside the visible region', () => {
      const inside = makeClinic({id: 'inside', lat: 37.77, lng: -122.42});
      const {result} = renderHook(() =>
        useMapRegionFilter({
          businesses: [inside],
          region: SF_REGION,
          searchQuery: '',
          category: undefined,
        }),
      );
      expect(result.current.map(c => c.id)).toContain('inside');
    });

    it('excludes clinics outside the visible region', () => {
      const outside = makeClinic({id: 'outside', lat: 34.05, lng: -118.24}); // LA
      const {result} = renderHook(() =>
        useMapRegionFilter({
          businesses: [outside],
          region: SF_REGION,
          searchQuery: '',
          category: undefined,
        }),
      );
      expect(result.current).toHaveLength(0);
    });

    it('returns all coordinate-having clinics when region is null', () => {
      const clinics = [
        makeClinic({id: 'sf', lat: 37.77, lng: -122.42}),
        makeClinic({id: 'la', lat: 34.05, lng: -118.24}),
      ];
      const {result} = renderHook(() =>
        useMapRegionFilter({
          businesses: clinics,
          region: null,
          searchQuery: '',
          category: undefined,
        }),
      );
      expect(result.current).toHaveLength(2);
    });
  });

  describe('category filtering', () => {
    it('filters to the selected category', () => {
      const clinics = [
        makeClinic({id: 'hospital', category: 'hospital'}),
        makeClinic({id: 'groomer', category: 'groomer'}),
      ];
      const {result} = renderHook(() =>
        useMapRegionFilter({
          businesses: clinics,
          region: null,
          searchQuery: '',
          category: 'groomer',
        }),
      );
      expect(result.current.map(c => c.id)).toEqual(['groomer']);
    });

    it('returns all categories when category is undefined', () => {
      const clinics = [
        makeClinic({id: 'h', category: 'hospital'}),
        makeClinic({id: 'g', category: 'groomer'}),
        makeClinic({id: 'b', category: 'boarder'}),
      ];
      const {result} = renderHook(() =>
        useMapRegionFilter({
          businesses: clinics,
          region: null,
          searchQuery: '',
          category: undefined,
        }),
      );
      expect(result.current).toHaveLength(3);
    });
  });

  describe('search filtering', () => {
    it('matches clinic name (case-insensitive)', () => {
      const clinics = [
        makeClinic({id: 'pacific', name: 'Pacific Animal Center'}),
        makeClinic({id: 'bay', name: 'Bay Vets'}),
      ];
      const {result} = renderHook(() =>
        useMapRegionFilter({
          businesses: clinics,
          region: null,
          searchQuery: 'pacific',
          category: undefined,
        }),
      );
      expect(result.current.map(c => c.id)).toEqual(['pacific']);
    });

    it('matches specialties', () => {
      const clinics = [
        makeClinic({id: 'card', specialties: ['Cardiology', 'Oncology']}),
        makeClinic({id: 'derm', specialties: ['Dermatology']}),
      ];
      const {result} = renderHook(() =>
        useMapRegionFilter({
          businesses: clinics,
          region: null,
          searchQuery: 'cardio',
          category: undefined,
        }),
      );
      expect(result.current.map(c => c.id)).toEqual(['card']);
    });

    it('matches address', () => {
      const clinic = makeClinic({address: '600 Alabama St, San Francisco'});
      const {result} = renderHook(() =>
        useMapRegionFilter({
          businesses: [clinic],
          region: null,
          searchQuery: 'alabama',
          category: undefined,
        }),
      );
      expect(result.current).toHaveLength(1);
    });

    it('ignores queries shorter than 2 characters', () => {
      const clinics = [
        makeClinic({id: 'a', name: 'Alpha'}),
        makeClinic({id: 'b', name: 'Beta'}),
      ];
      const {result} = renderHook(() =>
        useMapRegionFilter({
          businesses: clinics,
          region: null,
          searchQuery: 'a',
          category: undefined,
        }),
      );
      expect(result.current).toHaveLength(2);
    });

    it('returns empty array when no match', () => {
      const clinics = [makeClinic({name: 'Pacific Animal Center'})];
      const {result} = renderHook(() =>
        useMapRegionFilter({
          businesses: clinics,
          region: null,
          searchQuery: 'zzznomatch',
          category: undefined,
        }),
      );
      expect(result.current).toHaveLength(0);
    });

    it('applies all filters together (region + category + search)', () => {
      const clinics = [
        makeClinic({
          id: 'match',
          name: 'Cardio Clinic',
          category: 'hospital',
          lat: 37.77,
          lng: -122.42,
        }),
        makeClinic({
          id: 'wrong_cat',
          name: 'Cardio Groomer',
          category: 'groomer',
          lat: 37.77,
          lng: -122.42,
        }),
        makeClinic({
          id: 'out_region',
          name: 'Cardio LA',
          category: 'hospital',
          lat: 34.05,
          lng: -118.24,
        }),
      ];
      const {result} = renderHook(() =>
        useMapRegionFilter({
          businesses: clinics,
          region: SF_REGION,
          searchQuery: 'cardio',
          category: 'hospital',
        }),
      );
      expect(result.current.map(c => c.id)).toEqual(['match']);
    });
  });

  it('returns an empty array for an empty input list', () => {
    const {result} = renderHook(() =>
      useMapRegionFilter({
        businesses: [],
        region: null,
        searchQuery: '',
        category: undefined,
      }),
    );
    expect(result.current).toHaveLength(0);
  });
});
