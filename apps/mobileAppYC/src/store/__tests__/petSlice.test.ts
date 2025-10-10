import reducer, { clearPetError, setSelectedPet, fetchPets, addPet, updatePet, deletePet } from '@/store/slices/petSlice';
import type { PetState, Pet } from '@/store/types';

describe('store/petSlice reducer', () => {
  const initial: PetState = { pets: [], selectedPet: null, isLoading: false, error: null };

  test('clearPetError sets error to null', () => {
    const state = reducer({ ...initial, error: 'x' }, clearPetError());
    expect(state.error).toBeNull();
  });

  test('setSelectedPet updates selectedPet', () => {
    const pet = { id: '1', name: 'Buddy', type: 'Dog', breed: '', age: 1, weight: 1, image: '', description: '', ownerId: 'o', createdAt: '', updatedAt: '' } as Pet;
    const state = reducer(initial, setSelectedPet(pet));
    expect(state.selectedPet).toEqual(pet);
  });

  test('fetchPets pending/fulfilled', () => {
    let state = reducer(initial, { type: fetchPets.pending.type });
    expect(state.isLoading).toBe(true);
    const payload: Pet[] = [{ id: '1', name: 'B', type: 'Dog', breed: '', age: 1, weight: 1, image: '', description: '', ownerId: 'o', createdAt: '', updatedAt: '' }];
    state = reducer(state, { type: fetchPets.fulfilled.type, payload });
    expect(state.isLoading).toBe(false);
    expect(state.pets).toHaveLength(1);
  });

  test('addPet pending/fulfilled', () => {
    let state = reducer(initial, { type: addPet.pending.type });
    expect(state.isLoading).toBe(true);
    const newPet: Pet = { id: '2', name: 'C', type: 'Cat', breed: '', age: 2, weight: 2, image: '', description: '', ownerId: 'o', createdAt: '', updatedAt: '' };
    state = reducer(state, { type: addPet.fulfilled.type, payload: newPet });
    expect(state.isLoading).toBe(false);
    expect(state.pets.find(p => p.id === '2')).toBeTruthy();
  });

  test('updatePet pending/fulfilled updates existing pet', () => {
    const start: PetState = { ...initial, pets: [{ id: '3', name: 'Old', type: 'Dog', breed: '', age: 1, weight: 1, image: '', description: '', ownerId: 'o', createdAt: '', updatedAt: '' }] };
    let state = reducer(start, { type: updatePet.pending.type });
    const updated: Pet = { ...(start.pets[0] as Pet), name: 'New' };
    state = reducer(state, { type: updatePet.fulfilled.type, payload: updated });
    expect(state.pets[0].name).toBe('New');
  });

  test('deletePet pending/fulfilled removes pet and clears selection', () => {
    const start: PetState = { ...initial, pets: [{ id: '4', name: 'X', type: 'Dog', breed: '', age: 1, weight: 1, image: '', description: '', ownerId: 'o', createdAt: '', updatedAt: '' }], selectedPet: { id: '4' } as any };
    let state = reducer(start, { type: deletePet.pending.type });
    state = reducer(state, { type: deletePet.fulfilled.type, payload: '4' });
    expect(state.pets.find(p => p.id === '4')).toBeUndefined();
    expect(state.selectedPet).toBeNull();
  });
});

