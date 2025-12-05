import {
  selectLinkedBusinesses,
  selectLinkedBusinessesByCategory,
  selectLinkedBusinessesByCompanion,
  selectLinkedBusinessesLoading,
  selectLinkedBusinessesError,
  selectSelectedCategory,
  selectLinkedHospitalsForCompanion,
} from '../../../src/features/linkedBusinesses/selectors';
import type {RootState} from '@/app/store';

describe('features/linkedBusinesses/selectors', () => {
  const mockBusiness1 = {
    id: '1',
    name: 'City Vet',
    businessName: 'City Vet', // Add missing required prop
    category: 'hospital',
    companionId: 'c1',
    inviteStatus: 'accepted',
    state: 'active',
  };
  const mockBusiness2 = {
    id: '2',
    name: 'Happy Paws',
    businessName: 'Happy Paws',
    category: 'groomer',
    companionId: 'c1',
    inviteStatus: 'pending',
    state: 'pending',
  };
  const mockBusiness3 = {
    id: '3',
    name: 'Country Vet',
    businessName: 'Country Vet',
    category: 'hospital',
    companionId: 'c2',
    inviteStatus: 'accepted',
    state: 'active',
  };

  // Mock the full RootState structure
  const mockState = {
    linkedBusinesses: {
      linkedBusinesses: [mockBusiness1, mockBusiness2, mockBusiness3],
      loading: false,
      error: 'Test Error',
      selectedCategory: 'hospital',
    },
  } as unknown as RootState;

  it('selectLinkedBusinesses returns the full list', () => {
    const result = selectLinkedBusinesses(mockState);
    expect(result).toHaveLength(3);
    expect(result).toEqual([mockBusiness1, mockBusiness2, mockBusiness3]);
  });

  describe('selectLinkedBusinessesByCategory', () => {
    it('filters by existing category', () => {
      const result = selectLinkedBusinessesByCategory(mockState, 'hospital');
      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([mockBusiness1, mockBusiness3]),
      );
    });

    it('returns empty array for non-existent category', () => {
      const result = selectLinkedBusinessesByCategory(mockState, 'boarder');
      expect(result).toEqual([]);
    });
  });

  describe('selectLinkedBusinessesByCompanion', () => {
    it('filters by existing companionId', () => {
      const result = selectLinkedBusinessesByCompanion(mockState, 'c1');
      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([mockBusiness1, mockBusiness2]),
      );
    });

    it('returns empty array for companionId with no businesses', () => {
      const result = selectLinkedBusinessesByCompanion(mockState, 'c999');
      expect(result).toEqual([]);
    });
  });

  describe('selectLinkedHospitalsForCompanion', () => {
    it('filters hospitals for companion (accepted/active only)', () => {
      const result = selectLinkedHospitalsForCompanion(mockState, 'c1');
      // Should find mockBusiness1 (hospital, c1, accepted)
      // Should NOT find mockBusiness2 (groomer)
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockBusiness1);
    });

    it('returns empty if companionId is null', () => {
      const result = selectLinkedHospitalsForCompanion(mockState, null);
      expect(result).toEqual([]);
    });
  });

  it('selectLinkedBusinessesLoading returns loading state', () => {
    expect(selectLinkedBusinessesLoading(mockState)).toBe(false);

    const loadingState = {
      ...mockState,
      linkedBusinesses: {...mockState.linkedBusinesses, loading: true},
    } as unknown as RootState;
    expect(selectLinkedBusinessesLoading(loadingState)).toBe(true);
  });

  it('selectLinkedBusinessesError returns error state', () => {
    expect(selectLinkedBusinessesError(mockState)).toBe('Test Error');

    const noErrorState = {
      ...mockState,
      linkedBusinesses: {...mockState.linkedBusinesses, error: null},
    } as unknown as RootState;
    expect(selectLinkedBusinessesError(noErrorState)).toBeNull();
  });

  it('selectSelectedCategory returns the selected category', () => {
    expect(selectSelectedCategory(mockState)).toBe('hospital');

    const undefinedCategoryState = {
      ...mockState,
      linkedBusinesses: {
        ...mockState.linkedBusinesses,
        selectedCategory: undefined,
      },
    } as unknown as RootState;
    expect(selectSelectedCategory(undefinedCategoryState)).toBeUndefined();
  });
});