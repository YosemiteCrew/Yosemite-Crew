// __tests__/features/companion/companionSlice.test.ts
import companionReducer, {
  setSelectedCompanion,
  clearCompanionError,
  resetCompanionState,
  updateCompanion,
  removeCompanion,
} from '@/features/companion/companionSlice';
import {
  fetchCompanions,
  addCompanion,
  updateCompanionProfile,
  deleteCompanion,
} from '@/features/companion/thunks';
import type {CompanionState, Companion} from '@/features/companion/types';

describe('companionSlice', () => {
  const initialState: CompanionState = {
    companions: [],
    selectedCompanionId: null,
    loading: false,
    error: null,
  };

  const mockCompanion: Companion = {
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
    ...mockCompanion,
    id: 'companion_2',
    name: 'Max',
    category: 'cat',
  };

  describe('initial state', () => {
    it('should return the initial state', () => {
      expect(companionReducer(undefined, {type: 'unknown'})).toEqual(
        initialState
      );
    });
  });

  describe('reducers', () => {
    describe('setSelectedCompanion', () => {
      it('should set the selected companion ID', () => {
        const state = companionReducer(
          initialState,
          setSelectedCompanion('companion_1')
        );
        expect(state.selectedCompanionId).toBe('companion_1');
      });

      it('should set selected companion ID to null', () => {
        const stateWithSelection = {
          ...initialState,
          selectedCompanionId: 'companion_1',
        };
        const state = companionReducer(
          stateWithSelection,
          setSelectedCompanion(null)
        );
        expect(state.selectedCompanionId).toBeNull();
      });
    });

    describe('clearCompanionError', () => {
      it('should clear the error', () => {
        const stateWithError = {
          ...initialState,
          error: 'Some error occurred',
        };
        const state = companionReducer(stateWithError, clearCompanionError());
        expect(state.error).toBeNull();
      });

      it('should not affect other state properties', () => {
        const stateWithError = {
          ...initialState,
          companions: [mockCompanion],
          selectedCompanionId: 'companion_1',
          loading: true,
          error: 'Some error occurred',
        };
        const state = companionReducer(stateWithError, clearCompanionError());
        expect(state.companions).toEqual([mockCompanion]);
        expect(state.selectedCompanionId).toBe('companion_1');
        expect(state.loading).toBe(true);
        expect(state.error).toBeNull();
      });
    });

    describe('resetCompanionState', () => {
      it('should reset state to initial state', () => {
        const modifiedState = {
          companions: [mockCompanion, mockCompanion2],
          selectedCompanionId: 'companion_1',
          loading: true,
          error: 'Some error',
        };
        const state = companionReducer(modifiedState, resetCompanionState());
        expect(state).toEqual(initialState);
      });
    });

    describe('updateCompanion', () => {
      it('should update an existing companion', () => {
        const stateWithCompanions = {
          ...initialState,
          companions: [mockCompanion, mockCompanion2],
        };
        const updatedCompanion = {
          ...mockCompanion,
          name: 'Updated Buddy',
          currentWeight: 32,
        };
        const state = companionReducer(
          stateWithCompanions,
          updateCompanion(updatedCompanion)
        );
        expect(state.companions[0].name).toBe('Updated Buddy');
        expect(state.companions[0].currentWeight).toBe(32);
        expect(state.companions[1]).toEqual(mockCompanion2);
      });

      it('should not update if companion ID does not exist', () => {
        const stateWithCompanions = {
          ...initialState,
          companions: [mockCompanion],
        };
        const nonExistentCompanion = {
          ...mockCompanion,
          id: 'non_existent_id',
          name: 'Ghost',
        };
        const state = companionReducer(
          stateWithCompanions,
          updateCompanion(nonExistentCompanion)
        );
        expect(state.companions).toEqual([mockCompanion]);
        expect(state.companions.length).toBe(1);
      });
    });

    describe('removeCompanion', () => {
      it('should remove a companion by ID', () => {
        const stateWithCompanions = {
          ...initialState,
          companions: [mockCompanion, mockCompanion2],
        };
        const state = companionReducer(
          stateWithCompanions,
          removeCompanion('companion_1')
        );
        expect(state.companions).toEqual([mockCompanion2]);
        expect(state.companions.length).toBe(1);
      });

      it('should update selectedCompanionId to first companion when removing selected companion', () => {
        const stateWithCompanions = {
          ...initialState,
          companions: [mockCompanion, mockCompanion2],
          selectedCompanionId: 'companion_1',
        };
        const state = companionReducer(
          stateWithCompanions,
          removeCompanion('companion_1')
        );
        expect(state.companions).toEqual([mockCompanion2]);
        expect(state.selectedCompanionId).toBe('companion_2');
      });

      it('should set selectedCompanionId to null when removing the last companion', () => {
        const stateWithOneCompanion = {
          ...initialState,
          companions: [mockCompanion],
          selectedCompanionId: 'companion_1',
        };
        const state = companionReducer(
          stateWithOneCompanion,
          removeCompanion('companion_1')
        );
        expect(state.companions).toEqual([]);
        expect(state.selectedCompanionId).toBeNull();
      });

      it('should not affect selectedCompanionId when removing non-selected companion', () => {
        const stateWithCompanions = {
          ...initialState,
          companions: [mockCompanion, mockCompanion2],
          selectedCompanionId: 'companion_2',
        };
        const state = companionReducer(
          stateWithCompanions,
          removeCompanion('companion_1')
        );
        expect(state.companions).toEqual([mockCompanion2]);
        expect(state.selectedCompanionId).toBe('companion_2');
      });

      it('should do nothing if companion ID does not exist', () => {
        const stateWithCompanions = {
          ...initialState,
          companions: [mockCompanion],
        };
        const state = companionReducer(
          stateWithCompanions,
          removeCompanion('non_existent_id')
        );
        expect(state.companions).toEqual([mockCompanion]);
      });
    });
  });

  describe('extraReducers - fetchCompanions', () => {
    it('should set loading to true on pending', () => {
      const state = companionReducer(
        initialState,
        fetchCompanions.pending('requestId', 'user_1')
      );
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should set companions on fulfilled', () => {
      const companions = [mockCompanion, mockCompanion2];
      const state = companionReducer(
        {...initialState, loading: true},
        fetchCompanions.fulfilled(companions, 'requestId', 'user_1')
      );
      expect(state.loading).toBe(false);
      expect(state.companions).toEqual(companions);
      expect(state.error).toBeNull();
    });

    it('should set error on rejected', () => {
      const error = 'Failed to fetch companions';
      const state = companionReducer(
        {...initialState, loading: true},
        fetchCompanions.rejected(null, 'requestId', 'user_1', error)
      );
      expect(state.loading).toBe(false);
      expect(state.error).toBe(error);
    });

    it('should set default error message on rejected without payload', () => {
      const state = companionReducer(
        {...initialState, loading: true},
        fetchCompanions.rejected(null, 'requestId', 'user_1')
      );
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Failed to fetch companions');
    });
  });

  describe('extraReducers - updateCompanionProfile', () => {
    it('should set loading to true on pending', () => {
      const state = companionReducer(
        initialState,
        updateCompanionProfile.pending('requestId', {
          userId: 'user_1',
          updatedCompanion: mockCompanion,
        })
      );
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should update companion in state on fulfilled', () => {
      const stateWithCompanions = {
        ...initialState,
        companions: [mockCompanion, mockCompanion2],
        loading: true,
      };
      const updatedCompanion = {
        ...mockCompanion,
        name: 'Updated Buddy',
      };
      const state = companionReducer(
        stateWithCompanions,
        updateCompanionProfile.fulfilled(
          updatedCompanion,
          'requestId',
          {userId: 'user_1', updatedCompanion}
        )
      );
      expect(state.loading).toBe(false);
      expect(state.companions[0].name).toBe('Updated Buddy');
      expect(state.companions[1]).toEqual(mockCompanion2);
      expect(state.error).toBeNull();
    });

    it('should not update if companion not found', () => {
      const stateWithCompanions = {
        ...initialState,
        companions: [mockCompanion2],
        loading: true,
      };
      const updatedCompanion = {
        ...mockCompanion,
        name: 'Updated Buddy',
      };
      const state = companionReducer(
        stateWithCompanions,
        updateCompanionProfile.fulfilled(
          updatedCompanion,
          'requestId',
          {userId: 'user_1', updatedCompanion}
        )
      );
      expect(state.companions).toEqual([mockCompanion2]);
    });

    it('should set error on rejected', () => {
      const error = 'Failed to update companion';
      const state = companionReducer(
        {...initialState, loading: true},
        updateCompanionProfile.rejected(
          null,
          'requestId',
          {userId: 'user_1', updatedCompanion: mockCompanion},
          error
        )
      );
      expect(state.loading).toBe(false);
      expect(state.error).toBe(error);
    });

    it('should set default error message on rejected without payload', () => {
      const state = companionReducer(
        {...initialState, loading: true},
        updateCompanionProfile.rejected(
          null,
          'requestId',
          {userId: 'user_1', updatedCompanion: mockCompanion}
        )
      );
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Failed to update companion');
    });
  });

  describe('extraReducers - addCompanion', () => {
    it('should set loading to true on pending', () => {
      const state = companionReducer(
        initialState,
        addCompanion.pending('requestId', {
          userId: 'user_1',
          payload: {
            category: 'dog',
            name: 'Buddy',
            breed: null,
            dateOfBirth: null,
            gender: 'male',
            currentWeight: null,
            color: null,
            allergies: null,
            neuteredStatus: 'neutered',
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
          },
        })
      );
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should add new companion on fulfilled', () => {
      const state = companionReducer(
        initialState,
        addCompanion.fulfilled(
          mockCompanion,
          'requestId',
          {userId: 'user_1', payload: {} as any}
        )
      );
      expect(state.loading).toBe(false);
      expect(state.companions).toEqual([mockCompanion]);
      expect(state.error).toBeNull();
    });

    it('should append to existing companions on fulfilled', () => {
      const stateWithCompanions = {
        ...initialState,
        companions: [mockCompanion],
      };
      const state = companionReducer(
        stateWithCompanions,
        addCompanion.fulfilled(
          mockCompanion2,
          'requestId',
          {userId: 'user_1', payload: {} as any}
        )
      );
      expect(state.loading).toBe(false);
      expect(state.companions).toEqual([mockCompanion, mockCompanion2]);
    });

    it('should set error on rejected', () => {
      const error = 'Failed to add companion';
      const state = companionReducer(
        {...initialState, loading: true},
        addCompanion.rejected(
          null,
          'requestId',
          {userId: 'user_1', payload: {} as any},
          error
        )
      );
      expect(state.loading).toBe(false);
      expect(state.error).toBe(error);
    });

    it('should set default error message on rejected without payload', () => {
      const state = companionReducer(
        {...initialState, loading: true},
        addCompanion.rejected(
          null,
          'requestId',
          {userId: 'user_1', payload: {} as any}
        )
      );
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Failed to add companion');
    });
  });

  describe('extraReducers - deleteCompanion', () => {
    it('should set loading to true on pending', () => {
      const state = companionReducer(
        initialState,
        deleteCompanion.pending('requestId', {
          userId: 'user_1',
          companionId: 'companion_1',
        })
      );
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should remove companion on fulfilled', () => {
      const stateWithCompanions = {
        ...initialState,
        companions: [mockCompanion, mockCompanion2],
        loading: true,
      };
      const state = companionReducer(
        stateWithCompanions,
        deleteCompanion.fulfilled(
          'companion_1',
          'requestId',
          {userId: 'user_1', companionId: 'companion_1'}
        )
      );
      expect(state.loading).toBe(false);
      expect(state.companions).toEqual([mockCompanion2]);
      expect(state.error).toBeNull();
    });

    it('should update selectedCompanionId to first companion when deleting selected', () => {
      const stateWithCompanions = {
        ...initialState,
        companions: [mockCompanion, mockCompanion2],
        selectedCompanionId: 'companion_1',
        loading: true,
      };
      const state = companionReducer(
        stateWithCompanions,
        deleteCompanion.fulfilled(
          'companion_1',
          'requestId',
          {userId: 'user_1', companionId: 'companion_1'}
        )
      );
      expect(state.companions).toEqual([mockCompanion2]);
      expect(state.selectedCompanionId).toBe('companion_2');
    });

    it('should set selectedCompanionId to null when deleting last companion', () => {
      const stateWithOneCompanion = {
        ...initialState,
        companions: [mockCompanion],
        selectedCompanionId: 'companion_1',
        loading: true,
      };
      const state = companionReducer(
        stateWithOneCompanion,
        deleteCompanion.fulfilled(
          'companion_1',
          'requestId',
          {userId: 'user_1', companionId: 'companion_1'}
        )
      );
      expect(state.companions).toEqual([]);
      expect(state.selectedCompanionId).toBeNull();
    });

    it('should not affect selectedCompanionId when deleting non-selected companion', () => {
      const stateWithCompanions = {
        ...initialState,
        companions: [mockCompanion, mockCompanion2],
        selectedCompanionId: 'companion_2',
        loading: true,
      };
      const state = companionReducer(
        stateWithCompanions,
        deleteCompanion.fulfilled(
          'companion_1',
          'requestId',
          {userId: 'user_1', companionId: 'companion_1'}
        )
      );
      expect(state.companions).toEqual([mockCompanion2]);
      expect(state.selectedCompanionId).toBe('companion_2');
    });

    it('should set error on rejected', () => {
      const error = 'Failed to delete companion';
      const state = companionReducer(
        {...initialState, loading: true},
        deleteCompanion.rejected(
          null,
          'requestId',
          {userId: 'user_1', companionId: 'companion_1'},
          error
        )
      );
      expect(state.loading).toBe(false);
      expect(state.error).toBe(error);
    });

    it('should set default error message on rejected without payload', () => {
      const state = companionReducer(
        {...initialState, loading: true},
        deleteCompanion.rejected(
          null,
          'requestId',
          {userId: 'user_1', companionId: 'companion_1'}
        )
      );
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Failed to delete companion');
    });
  });
});
