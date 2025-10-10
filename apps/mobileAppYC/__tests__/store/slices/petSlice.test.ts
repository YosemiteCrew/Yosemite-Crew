import petReducer, {
  fetchPets,
  addPet,
  updatePet,
  deletePet,
  clearPetError,
  setSelectedPet,
} from '@/store/slices/petSlice';
import {PetState, Pet} from '@/store/types';
import {configureStore} from '@reduxjs/toolkit';

describe('petSlice', () => {
  const initialState: PetState = {
    pets: [],
    selectedPet: null,
    isLoading: false,
    error: null,
  };

  const mockPet: Pet = {
    id: '1',
    name: 'Buddy',
    type: 'Dog',
    breed: 'Golden Retriever',
    age: 3,
    weight: 25,
    image: 'https://picsum.photos/200/200?random=1',
    description: 'Friendly and energetic dog',
    ownerId: '1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  const mockPet2: Pet = {
    id: '2',
    name: 'Whiskers',
    type: 'Cat',
    breed: 'Persian',
    age: 2,
    weight: 4,
    image: 'https://picsum.photos/200/200?random=2',
    description: 'Calm and loving cat',
    ownerId: '1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  describe('initial state', () => {
    it('should return the initial state', () => {
      expect(petReducer(undefined, {type: 'unknown'})).toEqual(initialState);
    });
  });

  describe('reducers', () => {
    it('should handle clearPetError', () => {
      const stateWithError: PetState = {
        ...initialState,
        error: 'Some error',
      };
      const nextState = petReducer(stateWithError, clearPetError());
      expect(nextState.error).toBeNull();
    });

    it('should handle setSelectedPet', () => {
      const nextState = petReducer(initialState, setSelectedPet(mockPet));
      expect(nextState.selectedPet).toEqual(mockPet);
    });

    it('should handle setSelectedPet with null', () => {
      const stateWithSelected: PetState = {
        ...initialState,
        selectedPet: mockPet,
      };
      const nextState = petReducer(stateWithSelected, setSelectedPet(null));
      expect(nextState.selectedPet).toBeNull();
    });
  });

  describe('fetchPets thunk', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle pending state', () => {
      const action = {type: fetchPets.pending.type};
      const state = petReducer(initialState, action);
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle fulfilled state', async () => {
      const store = configureStore({
        reducer: {pets: petReducer},
      });

      const fetchPromise = store.dispatch(fetchPets());

      jest.advanceTimersByTime(1000);
      await fetchPromise;

      const state = store.getState().pets;
      expect(state.isLoading).toBe(false);
      expect(state.pets).toHaveLength(2);
      expect(state.pets[0].name).toBe('Buddy');
      expect(state.pets[1].name).toBe('Whiskers');
      expect(state.error).toBeNull();
    });

    it('should handle rejected state', () => {
      const action = {
        type: fetchPets.rejected.type,
        error: {message: 'Network error'},
      };
      const state = petReducer(initialState, action);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Network error');
    });

    it('should handle rejected state with default message', () => {
      const action = {
        type: fetchPets.rejected.type,
        error: {},
      };
      const state = petReducer(initialState, action);
      expect(state.error).toBe('Failed to fetch pets');
    });
  });

  describe('addPet thunk', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle pending state', () => {
      const action = {type: addPet.pending.type};
      const state = petReducer(initialState, action);
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle fulfilled state', async () => {
      const store = configureStore({
        reducer: {pets: petReducer},
      });

      const newPetData = {
        name: 'Max',
        type: 'Dog',
        breed: 'Labrador',
        age: 1,
        weight: 20,
        ownerId: '1',
      };

      const addPromise = store.dispatch(addPet(newPetData));

      jest.advanceTimersByTime(1000);
      await addPromise;

      const state = store.getState().pets;
      expect(state.isLoading).toBe(false);
      expect(state.pets).toHaveLength(1);
      expect(state.pets[0].name).toBe('Max');
      expect(state.pets[0].id).toBeDefined();
      expect(state.pets[0].createdAt).toBeDefined();
      expect(state.error).toBeNull();
    });

    it('should handle rejected state', () => {
      const action = {
        type: addPet.rejected.type,
        error: {message: 'Validation error'},
      };
      const state = petReducer(initialState, action);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Validation error');
    });

    it('should handle rejected state with default message', () => {
      const action = {
        type: addPet.rejected.type,
        error: {},
      };
      const state = petReducer(initialState, action);
      expect(state.error).toBe('Failed to add pet');
    });
  });

  describe('updatePet thunk', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle pending state', () => {
      const action = {type: updatePet.pending.type};
      const state = petReducer(initialState, action);
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle fulfilled state', async () => {
      const stateWithPets: PetState = {
        ...initialState,
        pets: [mockPet, mockPet2],
      };

      const store = configureStore({
        reducer: {pets: petReducer},
        preloadedState: {pets: stateWithPets},
      });

      const updatedPetData = {
        ...mockPet,
        name: 'Buddy Updated',
        age: 4,
      };

      const updatePromise = store.dispatch(updatePet(updatedPetData));

      jest.advanceTimersByTime(1000);
      await updatePromise;

      const state = store.getState().pets;
      expect(state.isLoading).toBe(false);
      expect(state.pets).toHaveLength(2);
      expect(state.pets[0].name).toBe('Buddy Updated');
      expect(state.pets[0].age).toBe(4);
      expect(state.error).toBeNull();
    });

    it('should not update if pet not found', async () => {
      const stateWithPets: PetState = {
        ...initialState,
        pets: [mockPet],
      };

      const store = configureStore({
        reducer: {pets: petReducer},
        preloadedState: {pets: stateWithPets},
      });

      const updatedPetData = {
        ...mockPet2,
        name: 'Non-existent Pet',
      };

      const updatePromise = store.dispatch(updatePet(updatedPetData));

      jest.advanceTimersByTime(1000);
      await updatePromise;

      const state = store.getState().pets;
      expect(state.pets).toHaveLength(1);
      expect(state.pets[0].name).toBe('Buddy');
    });

    it('should handle rejected state', () => {
      const action = {
        type: updatePet.rejected.type,
        error: {message: 'Update failed'},
      };
      const state = petReducer(initialState, action);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Update failed');
    });

    it('should handle rejected state with default message', () => {
      const action = {
        type: updatePet.rejected.type,
        error: {},
      };
      const state = petReducer(initialState, action);
      expect(state.error).toBe('Failed to update pet');
    });
  });

  describe('deletePet thunk', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle pending state', () => {
      const action = {type: deletePet.pending.type};
      const state = petReducer(initialState, action);
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle fulfilled state', async () => {
      const stateWithPets: PetState = {
        ...initialState,
        pets: [mockPet, mockPet2],
      };

      const store = configureStore({
        reducer: {pets: petReducer},
        preloadedState: {pets: stateWithPets},
      });

      const deletePromise = store.dispatch(deletePet('1'));

      jest.advanceTimersByTime(500);
      await deletePromise;

      const state = store.getState().pets;
      expect(state.isLoading).toBe(false);
      expect(state.pets).toHaveLength(1);
      expect(state.pets[0].id).toBe('2');
      expect(state.error).toBeNull();
    });

    it('should clear selectedPet if deleted pet was selected', async () => {
      const stateWithPets: PetState = {
        ...initialState,
        pets: [mockPet, mockPet2],
        selectedPet: mockPet,
      };

      const store = configureStore({
        reducer: {pets: petReducer},
        preloadedState: {pets: stateWithPets},
      });

      const deletePromise = store.dispatch(deletePet('1'));

      jest.advanceTimersByTime(500);
      await deletePromise;

      const state = store.getState().pets;
      expect(state.selectedPet).toBeNull();
    });

    it('should not clear selectedPet if different pet was deleted', async () => {
      const stateWithPets: PetState = {
        ...initialState,
        pets: [mockPet, mockPet2],
        selectedPet: mockPet,
      };

      const store = configureStore({
        reducer: {pets: petReducer},
        preloadedState: {pets: stateWithPets},
      });

      const deletePromise = store.dispatch(deletePet('2'));

      jest.advanceTimersByTime(500);
      await deletePromise;

      const state = store.getState().pets;
      expect(state.selectedPet).toEqual(mockPet);
    });

    it('should handle rejected state', () => {
      const action = {
        type: deletePet.rejected.type,
        error: {message: 'Delete failed'},
      };
      const state = petReducer(initialState, action);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Delete failed');
    });

    it('should handle rejected state with default message', () => {
      const action = {
        type: deletePet.rejected.type,
        error: {},
      };
      const state = petReducer(initialState, action);
      expect(state.error).toBe('Failed to delete pet');
    });
  });

  describe('combined scenarios', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle multiple operations in sequence', async () => {
      const store = configureStore({
        reducer: {pets: petReducer},
      });

      // Fetch pets
      const fetchPromise = store.dispatch(fetchPets());
      jest.advanceTimersByTime(1000);
      await fetchPromise;

      let state = store.getState().pets;
      expect(state.pets).toHaveLength(2);

      // Add a new pet
      const addPromise = store.dispatch(
        addPet({
          name: 'Charlie',
          type: 'Dog',
          breed: 'Beagle',
          ownerId: '1',
        }),
      );
      jest.advanceTimersByTime(1000);
      await addPromise;

      state = store.getState().pets;
      expect(state.pets).toHaveLength(3);

      // Delete a pet
      const deletePromise = store.dispatch(deletePet('1'));
      jest.advanceTimersByTime(500);
      await deletePromise;

      state = store.getState().pets;
      expect(state.pets).toHaveLength(2);
    });

    it('should clear error when starting new operation', () => {
      let state: PetState = {
        ...initialState,
        error: 'Previous error',
      };

      state = petReducer(state, {type: fetchPets.pending.type});
      expect(state.error).toBeNull();

      state.error = 'Another error';
      state = petReducer(state, {type: addPet.pending.type});
      expect(state.error).toBeNull();
    });
  });
});
