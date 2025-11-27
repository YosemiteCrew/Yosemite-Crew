import {
  selectLinkedBusinesses,
  selectLinkedBusinessesByCategory,
  selectLinkedBusinessesByCompanion,
  selectLinkedBusinessesLoading,
  selectLinkedBusinessesError,
  selectSelectedCategory,
} from '../../../src/features/linkedBusinesses/selectors';
import type {RootState} from '@/app/store';

describe('features/linkedBusinesses/selectors', () => {
  const mockBusiness1 = {
    id: '1',
    name: 'City Vet',
    category: 'hospital',
    companionId: 'c1',
  };
  const mockBusiness2 = {
    id: '2',
    name: 'Happy Paws',
    category: 'groomer',
    companionId: 'c1',
  };
  const mockBusiness3 = {
    id: '3',
    name: 'Country Vet',
    category: 'hospital',
    companionId: 'c2',
  };

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
      const result = selectLinkedBusinessesByCategory('hospital')(mockState);
      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([mockBusiness1, mockBusiness3]),
      );
    });

    it('returns empty array for non-existent category', () => {
      const result = selectLinkedBusinessesByCategory('boarder')(mockState);
      expect(result).toEqual([]);
    });
  });

  describe('selectLinkedBusinessesByCompanion', () => {
    it('filters by existing companionId', () => {
      const result = selectLinkedBusinessesByCompanion('c1')(mockState);
      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([mockBusiness1, mockBusiness2]),
      );
    });

    it('returns empty array for companionId with no businesses', () => {
      const result = selectLinkedBusinessesByCompanion('c999')(mockState);
      expect(result).toEqual([]);
    });
  });

  it('selectLinkedBusinessesLoading returns loading state', () => {
    expect(selectLinkedBusinessesLoading(mockState)).toBe(false);

    const loadingState = {
      ...mockState,
      linkedBusinesses: { ...mockState.linkedBusinesses, loading: true }
    } as unknown as RootState;
    expect(selectLinkedBusinessesLoading(loadingState)).toBe(true);
  });

  it('selectLinkedBusinessesError returns error state', () => {
    expect(selectLinkedBusinessesError(mockState)).toBe('Test Error');

    const noErrorState = {
        ...mockState,
        linkedBusinesses: { ...mockState.linkedBusinesses, error: null }
    } as unknown as RootState;
    expect(selectLinkedBusinessesError(noErrorState)).toBeNull();
  });

  it('selectSelectedCategory returns the selected category', () => {
    expect(selectSelectedCategory(mockState)).toBe('hospital');

    const undefinedCategoryState = {
        ...mockState,
        linkedBusinesses: { ...mockState.linkedBusinesses, selectedCategory: undefined }
    } as unknown as RootState;
    expect(selectSelectedCategory(undefinedCategoryState)).toBeUndefined();
  });
});