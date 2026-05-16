import {renderHook, act} from '@testing-library/react-native';
import {useClinicMapDiscovery} from '../../../../src/features/appointments/hooks/useClinicMapDiscovery';
import {MOCK_CLINICS} from '../../../../src/features/appointments/mocks/clinicMocks';
import type {VetBusiness} from '../../../../src/features/appointments/types';

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(),
}));

import {useSelector} from 'react-redux';
const mockUseSelector = useSelector as jest.Mock;

const makeReduxBusiness = (
  overrides: Partial<VetBusiness> = {},
): VetBusiness => ({
  id: 'redux_biz_1',
  name: 'Redux Clinic',
  category: 'hospital',
  address: '1 Redux Ave',
  lat: 37.78,
  lng: -122.41,
  ...overrides,
});

const setReduxBusinesses = (businesses: VetBusiness[]) => {
  mockUseSelector.mockImplementation((selector: (s: any) => any) =>
    selector({businesses: {businesses}}),
  );
};

beforeEach(() => {
  setReduxBusinesses([]);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('useClinicMapDiscovery', () => {
  describe('initial state', () => {
    it('starts with no selected clinic', () => {
      const {result} = renderHook(() => useClinicMapDiscovery(''));
      expect(result.current.selectedClinicId).toBeNull();
    });

    it('starts with no map region', () => {
      const {result} = renderHook(() => useClinicMapDiscovery(''));
      expect(result.current.mapRegion).toBeNull();
    });

    it('starts with no category filter', () => {
      const {result} = renderHook(() => useClinicMapDiscovery(''));
      expect(result.current.category).toBeUndefined();
    });
  });

  describe('mock clinic merging', () => {
    it('includes all 12 mock clinics when Redux store is empty', () => {
      const {result} = renderHook(() => useClinicMapDiscovery(''));
      expect(result.current.visibleClinics.length).toBeGreaterThanOrEqual(
        MOCK_CLINICS.length,
      );
    });

    it('handles undefined businesses slice gracefully (falls back to mock clinics)', () => {
      mockUseSelector.mockImplementation((selector: (s: any) => any) =>
        selector({businesses: undefined}),
      );
      const {result} = renderHook(() => useClinicMapDiscovery(''));
      // Should still show mock clinics even when Redux slice is unavailable
      expect(result.current.visibleClinics.length).toBeGreaterThanOrEqual(
        MOCK_CLINICS.length,
      );
    });

    it('merges Redux businesses with mock clinics without duplicates', () => {
      setReduxBusinesses([makeReduxBusiness({id: 'redux_unique'})]);
      const {result} = renderHook(() => useClinicMapDiscovery(''));
      const ids = result.current.visibleClinics.map(c => c.id);
      expect(ids).toContain('redux_unique');
      expect(ids).toContain('mock_clinic_01');
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('deduplicates when Redux business shares an id with a mock clinic', () => {
      setReduxBusinesses([
        makeReduxBusiness({id: 'mock_clinic_01', name: 'Override'}),
      ]);
      const {result} = renderHook(() => useClinicMapDiscovery(''));
      const matches = result.current.visibleClinics.filter(
        c => c.id === 'mock_clinic_01',
      );
      expect(matches).toHaveLength(1);
    });
  });

  describe('state setters', () => {
    it('updates selectedClinicId', () => {
      const {result} = renderHook(() => useClinicMapDiscovery(''));
      act(() => {
        result.current.setSelectedClinicId('mock_clinic_03');
      });
      expect(result.current.selectedClinicId).toBe('mock_clinic_03');
    });

    it('clears selectedClinicId when set to null', () => {
      const {result} = renderHook(() => useClinicMapDiscovery(''));
      act(() => result.current.setSelectedClinicId('mock_clinic_01'));
      act(() => result.current.setSelectedClinicId(null));
      expect(result.current.selectedClinicId).toBeNull();
    });

    it('updates category and filters visible clinics', () => {
      const {result} = renderHook(() => useClinicMapDiscovery(''));
      act(() => {
        result.current.setCategory('groomer');
      });
      expect(result.current.category).toBe('groomer');
      result.current.visibleClinics.forEach(c => {
        expect(c.category).toBe('groomer');
      });
    });

    it('resets category to undefined', () => {
      const {result} = renderHook(() => useClinicMapDiscovery(''));
      act(() => result.current.setCategory('groomer'));
      act(() => result.current.setCategory(undefined));
      expect(result.current.category).toBeUndefined();
    });

    it('updates mapRegion and limits visible clinics to that region', () => {
      const {result} = renderHook(() => useClinicMapDiscovery(''));
      const sfOnly = {
        latitude: 37.77,
        longitude: -122.42,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      act(() => {
        result.current.setMapRegion(sfOnly);
      });
      expect(result.current.mapRegion).toEqual(sfOnly);
      result.current.visibleClinics.forEach(c => {
        expect(Math.abs((c.lat ?? 0) - sfOnly.latitude)).toBeLessThanOrEqual(
          sfOnly.latitudeDelta / 2,
        );
      });
    });
  });

  describe('enrichWithDistance', () => {
    it('returns at least as many entries as mock clinics', () => {
      const {result} = renderHook(() => useClinicMapDiscovery(''));
      const enriched = result.current.enrichWithDistance({
        lat: 37.77,
        lng: -122.42,
      });
      expect(enriched.length).toBeGreaterThanOrEqual(MOCK_CLINICS.length);
    });

    it('adds distanceMi to clinics that have both lat and lng', () => {
      const {result} = renderHook(() => useClinicMapDiscovery(''));
      const enriched = result.current.enrichWithDistance({
        lat: 37.77,
        lng: -122.42,
      });
      enriched
        .filter(c => c.lat != null && c.lng != null)
        .forEach(c => {
          expect(typeof c.distanceMi).toBe('number');
          expect(c.distanceMi).toBeGreaterThanOrEqual(0);
        });
    });

    it('does not add distanceMi to clinics missing both lat and lng', () => {
      setReduxBusinesses([
        makeReduxBusiness({
          id: 'no_coords',
          lat: undefined,
          lng: undefined,
          distanceMi: undefined,
        }),
      ]);
      const {result} = renderHook(() => useClinicMapDiscovery(''));
      const enriched = result.current.enrichWithDistance({
        lat: 37.77,
        lng: -122.42,
      });
      const clinic = enriched.find(c => c.id === 'no_coords');
      expect(clinic?.distanceMi).toBeUndefined();
    });

    it('does not add distanceMi to clinics missing only lng', () => {
      setReduxBusinesses([
        makeReduxBusiness({
          id: 'lat_only',
          lat: 37.77,
          lng: undefined,
          distanceMi: undefined,
        }),
      ]);
      const {result} = renderHook(() => useClinicMapDiscovery(''));
      const enriched = result.current.enrichWithDistance({
        lat: 37.77,
        lng: -122.42,
      });
      const clinic = enriched.find(c => c.id === 'lat_only');
      expect(clinic?.distanceMi).toBeUndefined();
    });
  });

  describe('search query filtering', () => {
    it('filters visible clinics by name when query ≥ 2 characters', () => {
      const {result} = renderHook(() => useClinicMapDiscovery('Pacific'));
      result.current.visibleClinics.forEach(c => {
        const nameMatch = c.name.toLowerCase().includes('pacific');
        const addressMatch =
          c.address?.toLowerCase().includes('pacific') ?? false;
        const specialtyMatch =
          c.specialties?.some(s => s.toLowerCase().includes('pacific')) ??
          false;
        expect(nameMatch || addressMatch || specialtyMatch).toBe(true);
      });
    });
  });
});
