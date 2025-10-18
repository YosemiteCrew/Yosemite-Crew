// apps/mobileAppYC/__tests__/features/companion/selectors.test.ts

import {
  selectCompanionState,
  selectCompanions,
  selectSelectedCompanionId,
  selectSelectedCompanion,
  selectCompanionLoading,
  selectCompanionError,
  selectCompanionsByCategory,
} from '../../../src/features/companion/selectors';
import type { RootState } from '@/app/store';
import type { Companion, AddCompanionPayload } from '../../../src/features/companion/types';

// Helper to create consistent mock companion objects
const createMockCompanion = (id: string, overrides: Partial<Companion> = {}): Companion => {
    const basePayload: AddCompanionPayload = {
        name: `Test ${id}`,
        category: 'dog',
        breed: null,
        dateOfBirth: '2023-01-01',
        gender: 'male',
        currentWeight: 10,
        color: 'Brown',
        allergies: null,
        neuteredStatus: 'not-neutered',
        ageWhenNeutered: null,
        bloodGroup: null,
        microchipNumber: null,
        passportNumber: null,
        insuredStatus: 'not-insured',
        insuranceCompany: null,
        insurancePolicyNumber: null,
        countryOfOrigin: null,
        origin: 'unknown',
        profileImage: null,
    };

    return {
        ...basePayload,
        id: id,
        userId: `user-${id}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
};


const companion1 = createMockCompanion('c1', { name: 'Buddy', category: 'dog' });
const companion2 = createMockCompanion('c2', { name: 'Lucy', category: 'cat' });
const companion3 = createMockCompanion('c3', { name: 'Rex', category: 'dog' });

// Create a mock RootState object that matches the structure of your real state
const mockState: RootState = {
  companion: {
    companions: [companion1, companion2, companion3],
    selectedCompanionId: 'c1',
    loading: false,
    error: null,
  },
  // Add other slices of your state with their initial states to satisfy the RootState type
  // For example:
  // auth: { user: null, loading: false, error: null, ... },
  // theme: { mode: 'light', ... },
} as RootState; // Using 'as' to simplify mock state creation


describe('companion selectors', () => {
  it('selectCompanionState should return the companion state', () => {
    expect(selectCompanionState(mockState)).toEqual(mockState.companion);
  });

  it('selectCompanions should return the companions array', () => {
    expect(selectCompanions(mockState)).toEqual([companion1, companion2, companion3]);
  });

  it('selectSelectedCompanionId should return the selected ID', () => {
    expect(selectSelectedCompanionId(mockState)).toBe('c1');
  });

  it('selectCompanionLoading should return the loading status', () => {
    expect(selectCompanionLoading(mockState)).toBe(false);
    const loadingState = { ...mockState, companion: { ...mockState.companion, loading: true } };
    expect(selectCompanionLoading(loadingState)).toBe(true);
  });

  it('selectCompanionError should return the error message', () => {
    expect(selectCompanionError(mockState)).toBe(null);
    const errorState = { ...mockState, companion: { ...mockState.companion, error: 'Test Error' } };
    expect(selectCompanionError(errorState)).toBe('Test Error');
  });

  describe('selectSelectedCompanion', () => {
    it('should return the full companion object when an ID is selected and exists', () => {
      expect(selectSelectedCompanion(mockState)).toEqual(companion1);
    });

    it('should return null when the selected ID does not exist in the companions array', () => {
      const stateWithInvalidId = { ...mockState, companion: { ...mockState.companion, selectedCompanionId: 'c99' } };
      expect(selectSelectedCompanion(stateWithInvalidId)).toBeNull();
    });

    it('should return null when no ID is selected', () => {
      const stateWithNoId = { ...mockState, companion: { ...mockState.companion, selectedCompanionId: null } };
      expect(selectSelectedCompanion(stateWithNoId)).toBeNull();
    });

     it('should return null if companions array is empty', () => {
      const stateWithEmptyCompanions = { ...mockState, companion: { ...mockState.companion, companions: [] } };
      expect(selectSelectedCompanion(stateWithEmptyCompanions)).toBeNull();
    });
  });

  describe('selectCompanionsByCategory', () => {
    it('should return only companions matching the specified category', () => {
      const dogCompanions = selectCompanionsByCategory(mockState, 'dog');
      expect(dogCompanions).toHaveLength(2);
      expect(dogCompanions).toEqual([companion1, companion3]);
    });

    it('should return an empty array if no companions match the category', () => {
      // Assuming 'equine' is a valid category but not in our mock data
      const equineCompanions = selectCompanionsByCategory(mockState, 'equine');
      expect(equineCompanions).toHaveLength(0);
      expect(equineCompanions).toEqual([]);
    });

    it('should return an empty array if the companions list is empty', () => {
      const stateWithEmptyCompanions = { ...mockState, companion: { ...mockState.companion, companions: [] } };
      const dogCompanions = selectCompanionsByCategory(stateWithEmptyCompanions, 'dog');
      expect(dogCompanions).toHaveLength(0);
      expect(dogCompanions).toEqual([]);
    });
  });
});