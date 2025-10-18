import companionReducer, {
  setSelectedCompanion,
  clearCompanionError,
  resetCompanionState,
  updateCompanion,
  removeCompanion,
} from '../../../src/features/companion/companionSlice';
import {
  fetchCompanions,
  addCompanion,
} from '../../../src/features/companion/thunks';
import type {
  CompanionState,
  Companion,
  AddCompanionPayload,
} from '../../../src/features/companion/types';

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


const initialState: CompanionState = {
  companions: [],
  selectedCompanionId: null,
  loading: false,
  error: null,
};

const companion1 = createMockCompanion('c1', { name: 'Buddy' });
const companion2 = createMockCompanion('c2', { name: 'Lucy', category: 'cat'});

describe('companionSlice', () => {
  it('should return the initial state', () => {
    expect(companionReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  describe('reducers', () => {
    it('should handle setSelectedCompanion', () => {
      const state = companionReducer(initialState, setSelectedCompanion('c1'));
      expect(state.selectedCompanionId).toBe('c1');
      const nextState = companionReducer(state, setSelectedCompanion(null));
      expect(nextState.selectedCompanionId).toBe(null);
    });

    it('should handle clearCompanionError', () => {
      const stateWithError: CompanionState = { ...initialState, error: 'Some error' };
      const state = companionReducer(stateWithError, clearCompanionError());
      expect(state.error).toBe(null);
    });

    it('should handle resetCompanionState', () => {
      const currentState: CompanionState = {
        companions: [companion1],
        selectedCompanionId: 'c1',
        loading: true,
        error: 'Some error',
      };
      const state = companionReducer(currentState, resetCompanionState());
      expect(state).toEqual(initialState);
    });

    it('should handle updateCompanion when companion exists', () => {
      const initialStateWithCompanion: CompanionState = { ...initialState, companions: [companion1] };
      const updatedCompanion = { ...companion1, name: 'Buddy Updated' };
      const state = companionReducer(initialStateWithCompanion, updateCompanion(updatedCompanion));
      expect(state.companions).toHaveLength(1);
      expect(state.companions[0].name).toBe('Buddy Updated');
    });

    it('should not update state if updateCompanion ID does not exist', () => {
      const initialStateWithCompanion: CompanionState = { ...initialState, companions: [companion1] };
      const nonExistentCompanion = createMockCompanion('c3');
      const state = companionReducer(initialStateWithCompanion, updateCompanion(nonExistentCompanion));
      expect(state.companions).toEqual([companion1]);
    });

    it('should handle removeCompanion when companion exists', () => {
      const initialStateWithCompanions: CompanionState = { ...initialState, companions: [companion1, companion2] };
      const state = companionReducer(initialStateWithCompanions, removeCompanion('c1'));
      expect(state.companions).toHaveLength(1);
      expect(state.companions[0].id).toBe('c2');
    });

     it('should handle removeCompanion and clear selectedId if it matches', () => {
      const initialStateWithCompanions: CompanionState = {
        ...initialState,
        companions: [companion1, companion2],
        selectedCompanionId: 'c1',
      };
      const state = companionReducer(initialStateWithCompanions, removeCompanion('c1'));
      expect(state.companions).toHaveLength(1);
      expect(state.companions[0].id).toBe('c2');
      expect(state.selectedCompanionId).toBeNull();
    });

     it('should handle removeCompanion and keep selectedId if it does not match', () => {
      const initialStateWithCompanions: CompanionState = {
        ...initialState,
        companions: [companion1, companion2],
        selectedCompanionId: 'c2',
      };
      const state = companionReducer(initialStateWithCompanions, removeCompanion('c1'));
      expect(state.companions).toHaveLength(1);
      expect(state.companions[0].id).toBe('c2');
      expect(state.selectedCompanionId).toBe('c2');
    });

    it('should not change state if removeCompanion ID does not exist', () => {
      const initialStateWithCompanions: CompanionState = { ...initialState, companions: [companion1, companion2] };
      const state = companionReducer(initialStateWithCompanions, removeCompanion('c3'));
      expect(state.companions).toEqual([companion1, companion2]);
    });
  });

  describe('extraReducers (Thunks)', () => {
    it('should handle fetchCompanions.pending', () => {
      const state = companionReducer(initialState, fetchCompanions.pending('reqId', 'userId'));
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle fetchCompanions.fulfilled', () => {
      const state = companionReducer({ ...initialState, loading: true }, fetchCompanions.fulfilled([companion1], 'reqId', 'userId'));
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.companions).toEqual([companion1]);
    });

    it('should handle fetchCompanions.rejected', () => {
      const errorMsg = 'Failed badly';
      const action = { type: fetchCompanions.rejected.type, payload: errorMsg };
      const state = companionReducer({ ...initialState, loading: true }, action);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(errorMsg);
    });

     it('should handle fetchCompanions.rejected with default message if payload is undefined', () => {
      const action = { type: fetchCompanions.rejected.type, payload: undefined };
      const state = companionReducer({ ...initialState, loading: true }, action);
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Failed to fetch companions');
    });

    it('should handle addCompanion.pending', () => {
      const state = companionReducer(initialState, addCompanion.pending('reqId', { userId: 'u1', payload: {} as AddCompanionPayload }));
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle addCompanion.fulfilled', () => {
        const initialStateWithCompanion1: CompanionState = {...initialState, companions: [companion1]};
        const state = companionReducer(
            initialStateWithCompanion1,
            addCompanion.fulfilled(companion2, 'reqId', { userId: 'u1', payload: {} as AddCompanionPayload })
        );
        expect(state.loading).toBe(false);
        expect(state.error).toBeNull();
        expect(state.companions).toHaveLength(2);
        expect(state.companions).toEqual([companion1, companion2]);
    });

    it('should handle addCompanion.rejected', () => {
        const errorMsg = 'Failed badly';
        const action = { type: addCompanion.rejected.type, payload: errorMsg };
        const state = companionReducer({ ...initialState, loading: true }, action);
        expect(state.loading).toBe(false);
        expect(state.error).toBe(errorMsg);
    });

    it('should handle addCompanion.rejected with default message if payload is undefined', () => {
        const action = { type: addCompanion.rejected.type, payload: undefined };
        const state = companionReducer({ ...initialState, loading: true }, action);
        expect(state.loading).toBe(false);
        expect(state.error).toBe('Failed to add companion');
    });
  });
});