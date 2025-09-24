// src/store/slices/petSlice.ts - Fixed setTimeout issues
import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {PetState, Pet} from '../types';

const initialState: PetState = {
  pets: [],
  selectedPet: null,
  isLoading: false,
  error: null,
};

// Mock data
const mockPets: Pet[] = [
  {
    id: '1',
    name: 'Buddy',
    type: 'Dog',
    breed: 'Golden Retriever',
    age: 3,
    weight: 25,
    image: 'https://picsum.photos/200/200?random=1',
    description: 'Friendly and energetic dog',
    ownerId: '1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Whiskers',
    type: 'Cat',
    breed: 'Persian',
    age: 2,
    weight: 4,
    image: 'https://picsum.photos/200/200?random=2',
    description: 'Calm and loving cat',
    ownerId: '1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Async thunks with fixed setTimeout
export const fetchPets = createAsyncThunk('pets/fetchPets', async () => {
  // Simulate API call - Fixed resolve parameter
  await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));
  return mockPets;
});

export const addPet = createAsyncThunk(
  'pets/addPet',
  async (petData: Omit<Pet, 'id' | 'createdAt' | 'updatedAt'>) => {
    // Simulate API call - Fixed resolve parameter
    await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));
    
    const newPet: Pet = {
      ...petData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    return newPet;
  },
);

export const updatePet = createAsyncThunk(
  'pets/updatePet',
  async (petData: Pet) => {
    // Simulate API call - Fixed resolve parameter
    await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));
    
    const updatedPet: Pet = {
      ...petData,
      updatedAt: new Date().toISOString(),
    };
    
    return updatedPet;
  },
);

export const deletePet = createAsyncThunk(
  'pets/deletePet',
  async (petId: string) => {
    // Simulate API call - Fixed resolve parameter
    await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
    return petId;
  },
);

const petSlice = createSlice({
  name: 'pets',
  initialState,
  reducers: {
    clearPetError: state => {
      state.error = null;
    },
    setSelectedPet: (state, action: PayloadAction<Pet | null>) => {
      state.selectedPet = action.payload;
    },
  },
  extraReducers: builder => {
    // Fetch pets
    builder.addCase(fetchPets.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchPets.fulfilled, (state, action) => {
      state.isLoading = false;
      state.pets = action.payload;
      state.error = null;
    });
    builder.addCase(fetchPets.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.error.message || 'Failed to fetch pets';
    });

    // Add pet
    builder.addCase(addPet.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(addPet.fulfilled, (state, action) => {
      state.isLoading = false;
      state.pets.push(action.payload);
      state.error = null;
    });
    builder.addCase(addPet.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.error.message || 'Failed to add pet';
    });

    // Update pet
    builder.addCase(updatePet.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(updatePet.fulfilled, (state, action) => {
      state.isLoading = false;
      const index = state.pets.findIndex(pet => pet.id === action.payload.id);
      if (index !== -1) {
        state.pets[index] = action.payload;
      }
      state.error = null;
    });
    builder.addCase(updatePet.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.error.message || 'Failed to update pet';
    });

    // Delete pet
    builder.addCase(deletePet.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(deletePet.fulfilled, (state, action) => {
      state.isLoading = false;
      state.pets = state.pets.filter(pet => pet.id !== action.payload);
      if (state.selectedPet?.id === action.payload) {
        state.selectedPet = null;
      }
      state.error = null;
    });
    builder.addCase(deletePet.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.error.message || 'Failed to delete pet';
    });
  },
});

export const {clearPetError, setSelectedPet} = petSlice.actions;
export default petSlice.reducer;