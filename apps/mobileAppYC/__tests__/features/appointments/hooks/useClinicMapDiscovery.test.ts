import {renderHook, act} from '@testing-library/react-native';
import {useClinicMapDiscovery} from '../../../../src/features/appointments/hooks/useClinicMapDiscovery';

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

  describe('redux businesses', () => {
    it('returns empty list when Redux store is empty', () => {
      const {result} = renderHook(() => useClinicMapDiscovery(''));
      expect(result.current.visibleClinics.length).toBe(0);
    });

    it('handles undefined businesses slice gracefully (returns empty list)', () => {
      mockUseSelector.mockImplementation((selector: (s: any) => any) =>
        selector({businesses: undefined}),
      );
      const {result} = renderHook(() => useClinicMapDiscovery(''));
      expect(result.current.visibleClinics.length).toBe(0);
    });

    it('shows Redux businesses in visible clinics', () => {
      setReduxBusinesses([makeReduxBusiness({id: 'redux_unique'})]);
      const {result} = renderHook(() => useClinicMapDiscovery(''));
      const ids = result.current.visibleClinics.map(c => c.id);
      expect(ids).toContain('redux_unique');
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('shows multiple Redux businesses without duplicates', () => {
      setReduxBusinesses([
        makeReduxBusiness({id: 'biz_01', name: 'First'}),
        makeReduxBusiness({id: 'biz_02', name: 'Second'}),
      ]);
      const {result} = renderHook(() => useClinicMapDiscovery(''));
      const ids = result.current.visibleClinics.map(c => c.id);
      expect(ids).toContain('biz_01');
      expect(ids).toContain('biz_02');
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
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
    it('returns entries matching the Redux businesses', () => {
      setReduxBusinesses([
        makeReduxBusiness({id: 'biz_a', lat: 37.77, lng: -122.42}),
        makeReduxBusiness({id: 'biz_b', lat: 37.8, lng: -122.41}),
      ]);
      const {result} = renderHook(() => useClinicMapDiscovery(''));
      const enriched = result.current.enrichWithDistance({
        lat: 37.77,
        lng: -122.42,
      });
      expect(enriched.length).toBe(2);
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

  describe('initialSelectedId with selectionToken', () => {
    it('auto-selects a clinic that is already in allClinics', () => {
      setReduxBusinesses([makeReduxBusiness({id: 'redux_biz_1'})]);
      const {result} = renderHook(() =>
        useClinicMapDiscovery('', 'redux_biz_1', 1000),
      );
      expect(result.current.selectedClinicId).toBe('redux_biz_1');
    });

    it('waits and selects when the business arrives in Redux after mount', () => {
      setReduxBusinesses([]);
      const {result, rerender} = renderHook(
        ({id, token}: {id: string | undefined; token: number}) =>
          useClinicMapDiscovery('', id, token),
        {initialProps: {id: 'redux_late_biz', token: 1000}},
      );
      expect(result.current.selectedClinicId).toBeNull();

      act(() => {
        setReduxBusinesses([makeReduxBusiness({id: 'redux_late_biz'})]);
      });
      rerender({id: 'redux_late_biz', token: 1000});

      expect(result.current.selectedClinicId).toBe('redux_late_biz');
    });

    it('does not select when initialSelectedId or token is absent', () => {
      const {result} = renderHook(() =>
        useClinicMapDiscovery('', undefined, undefined),
      );
      expect(result.current.selectedClinicId).toBeNull();
    });

    it('does not re-select after manual clear when token is unchanged', () => {
      setReduxBusinesses([makeReduxBusiness({id: 'redux_biz_1'})]);
      const {result} = renderHook(() =>
        useClinicMapDiscovery('', 'redux_biz_1', 1000),
      );
      expect(result.current.selectedClinicId).toBe('redux_biz_1');

      act(() => result.current.setSelectedClinicId(null));
      expect(result.current.selectedClinicId).toBeNull();
    });

    it('re-selects when navigating again with a new selectionToken', () => {
      setReduxBusinesses([makeReduxBusiness({id: 'redux_biz_1'})]);
      const {result, rerender} = renderHook(
        ({token}: {token: number}) =>
          useClinicMapDiscovery('', 'redux_biz_1', token),
        {initialProps: {token: 1000}},
      );
      expect(result.current.selectedClinicId).toBe('redux_biz_1');

      act(() => result.current.setSelectedClinicId(null));
      expect(result.current.selectedClinicId).toBeNull();

      rerender({token: 2000});
      expect(result.current.selectedClinicId).toBe('redux_biz_1');
    });

    it('keeps initial business in visibleClinics after Redux array is replaced', () => {
      setReduxBusinesses([makeReduxBusiness({id: 'pinned_biz'})]);
      const {result, rerender} = renderHook(
        ({id, token}: {id: string; token: number}) =>
          useClinicMapDiscovery('', id, token),
        {initialProps: {id: 'pinned_biz', token: 1000}},
      );
      expect(result.current.selectedClinicId).toBe('pinned_biz');

      act(() => {
        setReduxBusinesses([makeReduxBusiness({id: 'other_biz'})]);
      });
      rerender({id: 'pinned_biz', token: 1000});

      expect(result.current.visibleClinics.map(c => c.id)).toContain(
        'pinned_biz',
      );
      expect(result.current.selectedClinicId).toBe('pinned_biz');
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
