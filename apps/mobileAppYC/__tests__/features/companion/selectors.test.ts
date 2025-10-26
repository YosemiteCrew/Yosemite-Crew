// __tests__/features/companion/selectors.test.ts
import {
  selectCompanionState,
  selectCompanions,
  selectSelectedCompanionId,
  selectSelectedCompanion,
  selectCompanionLoading,
  selectCompanionError,
  selectCompanionsByCategory,
} from '@/features/companion/selectors';
import type {RootState} from '@/app/store';
import type {Companion, CompanionState} from '@/features/companion/types';

describe('companion selectors', () => {
  const mockCompanion1: Companion = {
    id: 'companion_1',
    userId: 'user_1',
    category: 'dog',
    name: 'Buddy',
    breed: {
      speciesId: 1,
      speciesName: 'Dog',
      breedId: 101,
      breedName: 'Golden Retriever',
    },
    dateOfBirth: '2020-01-15',
    gender: 'male',
    currentWeight: 30,
    color: 'Golden',
    allergies: null,
    neuteredStatus: 'neutered',
    ageWhenNeutered: '1 year',
    bloodGroup: 'DEA 1.1',
    microchipNumber: '123456789',
    passportNumber: null,
    insuredStatus: 'insured',
    insuranceCompany: 'Pet Insurance Co',
    insurancePolicyNumber: 'POL123',
    countryOfOrigin: 'USA',
    origin: 'breeder',
    profileImage: null,
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z',
  };

  const mockCompanion2: Companion = {
    ...mockCompanion1,
    id: 'companion_2',
    name: 'Max',
    category: 'cat',
  };

  const mockCompanion3: Companion = {
    ...mockCompanion1,
    id: 'companion_3',
    name: 'Rex',
    category: 'dog',
  };

  const createMockState = (
    companionState: Partial<CompanionState> = {}
  ): RootState => {
    return {
      companion: {
        companions: [],
        selectedCompanionId: null,
        loading: false,
        error: null,
        ...companionState,
      },
      // Add other required state slices as needed
      auth: {} as any,
      theme: {} as any,
      documents: {} as any,
    } as RootState;
  };

  describe('selectCompanionState', () => {
    it('should select the companion state', () => {
      const state = createMockState({
        companions: [mockCompanion1],
        loading: true,
        error: 'test error',
      });

      const result = selectCompanionState(state);

      expect(result).toEqual(state.companion);
      expect(result.companions).toEqual([mockCompanion1]);
      expect(result.loading).toBe(true);
      expect(result.error).toBe('test error');
    });

    it('should select empty companion state', () => {
      const state = createMockState();

      const result = selectCompanionState(state);

      expect(result.companions).toEqual([]);
      expect(result.selectedCompanionId).toBeNull();
      expect(result.loading).toBe(false);
      expect(result.error).toBeNull();
    });
  });

  describe('selectCompanions', () => {
    it('should select all companions', () => {
      const companions = [mockCompanion1, mockCompanion2, mockCompanion3];
      const state = createMockState({companions});

      const result = selectCompanions(state);

      expect(result).toEqual(companions);
      expect(result).toHaveLength(3);
    });

    it('should select empty array when no companions', () => {
      const state = createMockState({companions: []});

      const result = selectCompanions(state);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should memoize the result', () => {
      const companions = [mockCompanion1];
      const state = createMockState({companions});

      const result1 = selectCompanions(state);
      const result2 = selectCompanions(state);

      expect(result1).toBe(result2);
    });

    it('should return new reference when companions change', () => {
      const state1 = createMockState({companions: [mockCompanion1]});
      const state2 = createMockState({companions: [mockCompanion2]});

      const result1 = selectCompanions(state1);
      const result2 = selectCompanions(state2);

      expect(result1).not.toBe(result2);
      expect(result1).toEqual([mockCompanion1]);
      expect(result2).toEqual([mockCompanion2]);
    });
  });

  describe('selectSelectedCompanionId', () => {
    it('should select the selected companion ID', () => {
      const state = createMockState({selectedCompanionId: 'companion_1'});

      const result = selectSelectedCompanionId(state);

      expect(result).toBe('companion_1');
    });

    it('should return null when no companion is selected', () => {
      const state = createMockState({selectedCompanionId: null});

      const result = selectSelectedCompanionId(state);

      expect(result).toBeNull();
    });

    it('should memoize the result', () => {
      const state = createMockState({selectedCompanionId: 'companion_1'});

      const result1 = selectSelectedCompanionId(state);
      const result2 = selectSelectedCompanionId(state);

      expect(result1).toBe(result2);
    });
  });

  describe('selectSelectedCompanion', () => {
    it('should select the selected companion', () => {
      const companions = [mockCompanion1, mockCompanion2];
      const state = createMockState({
        companions,
        selectedCompanionId: 'companion_1',
      });

      const result = selectSelectedCompanion(state);

      expect(result).toEqual(mockCompanion1);
    });

    it('should return null when no companion is selected', () => {
      const companions = [mockCompanion1, mockCompanion2];
      const state = createMockState({
        companions,
        selectedCompanionId: null,
      });

      const result = selectSelectedCompanion(state);

      expect(result).toBeNull();
    });

    it('should return null when selected companion does not exist', () => {
      const companions = [mockCompanion1];
      const state = createMockState({
        companions,
        selectedCompanionId: 'non_existent_id',
      });

      const result = selectSelectedCompanion(state);

      expect(result).toBeNull();
    });

    it('should return null when companions array is empty', () => {
      const state = createMockState({
        companions: [],
        selectedCompanionId: 'companion_1',
      });

      const result = selectSelectedCompanion(state);

      expect(result).toBeNull();
    });

    it('should memoize the result', () => {
      const companions = [mockCompanion1, mockCompanion2];
      const state = createMockState({
        companions,
        selectedCompanionId: 'companion_1',
      });

      const result1 = selectSelectedCompanion(state);
      const result2 = selectSelectedCompanion(state);

      expect(result1).toBe(result2);
    });

    it('should return different result when selection changes', () => {
      const companions = [mockCompanion1, mockCompanion2];
      const state1 = createMockState({
        companions,
        selectedCompanionId: 'companion_1',
      });
      const state2 = createMockState({
        companions,
        selectedCompanionId: 'companion_2',
      });

      const result1 = selectSelectedCompanion(state1);
      const result2 = selectSelectedCompanion(state2);

      expect(result1).toEqual(mockCompanion1);
      expect(result2).toEqual(mockCompanion2);
      expect(result1).not.toBe(result2);
    });
  });

  describe('selectCompanionLoading', () => {
    it('should select loading state as true', () => {
      const state = createMockState({loading: true});

      const result = selectCompanionLoading(state);

      expect(result).toBe(true);
    });

    it('should select loading state as false', () => {
      const state = createMockState({loading: false});

      const result = selectCompanionLoading(state);

      expect(result).toBe(false);
    });

    it('should memoize the result', () => {
      const state = createMockState({loading: true});

      const result1 = selectCompanionLoading(state);
      const result2 = selectCompanionLoading(state);

      expect(result1).toBe(result2);
    });
  });

  describe('selectCompanionError', () => {
    it('should select error message', () => {
      const errorMessage = 'Failed to load companions';
      const state = createMockState({error: errorMessage});

      const result = selectCompanionError(state);

      expect(result).toBe(errorMessage);
    });

    it('should return null when no error', () => {
      const state = createMockState({error: null});

      const result = selectCompanionError(state);

      expect(result).toBeNull();
    });

    it('should memoize the result', () => {
      const state = createMockState({error: 'test error'});

      const result1 = selectCompanionError(state);
      const result2 = selectCompanionError(state);

      expect(result1).toBe(result2);
    });
  });

  describe('selectCompanionsByCategory', () => {
    it('should select companions by category - dog', () => {
      const companions = [mockCompanion1, mockCompanion2, mockCompanion3];
      const state = createMockState({companions});

      const result = selectCompanionsByCategory(state, 'dog');

      expect(result).toHaveLength(2);
      expect(result).toEqual([mockCompanion1, mockCompanion3]);
    });

    it('should select companions by category - cat', () => {
      const companions = [mockCompanion1, mockCompanion2, mockCompanion3];
      const state = createMockState({companions});

      const result = selectCompanionsByCategory(state, 'cat');

      expect(result).toHaveLength(1);
      expect(result).toEqual([mockCompanion2]);
    });

    it('should return empty array when no companions match category', () => {
      const companions = [mockCompanion1, mockCompanion3];
      const state = createMockState({companions});

      const result = selectCompanionsByCategory(state, 'horse');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should return empty array when companions array is empty', () => {
      const state = createMockState({companions: []});

      const result = selectCompanionsByCategory(state, 'dog');

      expect(result).toEqual([]);
    });

    it('should memoize the result for same inputs', () => {
      const companions = [mockCompanion1, mockCompanion2, mockCompanion3];
      const state = createMockState({companions});

      const result1 = selectCompanionsByCategory(state, 'dog');
      const result2 = selectCompanionsByCategory(state, 'dog');

      expect(result1).toBe(result2);
    });

    it('should return different results for different categories', () => {
      const companions = [mockCompanion1, mockCompanion2, mockCompanion3];
      const state = createMockState({companions});

      const dogs = selectCompanionsByCategory(state, 'dog');
      const cats = selectCompanionsByCategory(state, 'cat');

      expect(dogs).not.toBe(cats);
      expect(dogs).toHaveLength(2);
      expect(cats).toHaveLength(1);
    });

    it('should handle all valid category types', () => {
      const dogCompanion: Companion = {...mockCompanion1, category: 'dog'};
      const catCompanion: Companion = {...mockCompanion1, id: 'cat_1', category: 'cat'};
      const horseCompanion: Companion = {...mockCompanion1, id: 'horse_1', category: 'horse'};

      const companions = [dogCompanion, catCompanion, horseCompanion];
      const state = createMockState({companions});

      expect(selectCompanionsByCategory(state, 'dog')).toEqual([dogCompanion]);
      expect(selectCompanionsByCategory(state, 'cat')).toEqual([catCompanion]);
      expect(selectCompanionsByCategory(state, 'horse')).toEqual([horseCompanion]);
    });
  });
});
