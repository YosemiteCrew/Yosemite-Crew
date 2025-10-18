// __tests__/features/companion/thunks.test.ts
import {configureStore} from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import companionReducer from '@/features/companion/companionSlice';
import {
  fetchCompanions,
  addCompanion,
  updateCompanionProfile,
  deleteCompanion,
} from '@/features/companion/thunks';
import type {Companion, AddCompanionPayload} from '@/features/companion/types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

const createTestStore = () => {
  return configureStore({
    reducer: {
      companion: companionReducer,
    },
  });
};

type TestStore = ReturnType<typeof createTestStore>;

describe('companion thunks', () => {
  let store: TestStore;
  const userId = 'user_123';
  const storageKey = `companions_${userId}`;

  const mockCompanion: Companion = {
    id: 'companion_1',
    userId: 'user_123',
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

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
    // Speed up tests by reducing mock delay
    jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
      cb();
      return 0 as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchCompanions', () => {
    it('should fetch companions from AsyncStorage', async () => {
      const companions = [mockCompanion, mockCompanion2];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(companions)
      );

      await store.dispatch(fetchCompanions(userId) as any);

      expect(AsyncStorage.getItem).toHaveBeenCalledWith(storageKey);
      const state = store.getState().companion;
      expect(state.companions).toEqual(companions);
      expect(state.loading).toBe(false);
    });

    it('should return empty array when no companions exist', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await store.dispatch(fetchCompanions(userId) as any);

      expect(AsyncStorage.getItem).toHaveBeenCalledWith(storageKey);
      const state = store.getState().companion;
      expect(state.companions).toEqual([]);
    });

    it('should handle errors', async () => {
      const errorMessage = 'Storage error';
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      await store.dispatch(fetchCompanions(userId) as any);

      const state = store.getState().companion;
      expect(state.error).toBe(errorMessage);
    });

    it('should handle non-Error exceptions', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue('Some error');

      await store.dispatch(fetchCompanions(userId) as any);

      const state = store.getState().companion;
      expect(state.error).toBe('Failed to fetch companions');
    });
  });

  describe('addCompanion', () => {
    const payload: AddCompanionPayload = {
      category: 'dog',
      name: 'New Buddy',
      breed: null,
      dateOfBirth: '2023-01-01',
      gender: 'male',
      currentWeight: 25,
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
      countryOfOrigin: 'USA',
      origin: 'breeder',
      profileImage: null,
    };

    it('should add a new companion to empty storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await store.dispatch(addCompanion({userId, payload}) as any);

      expect(AsyncStorage.getItem).toHaveBeenCalledWith(storageKey);
      expect(AsyncStorage.setItem).toHaveBeenCalled();

      const savedData = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      const savedCompanions = JSON.parse(savedData);

      expect(savedCompanions).toHaveLength(1);
      expect(savedCompanions[0].name).toBe('New Buddy');
      expect(savedCompanions[0].userId).toBe(userId);
      expect(savedCompanions[0].id).toBeDefined();
      expect(savedCompanions[0].createdAt).toBeDefined();
      expect(savedCompanions[0].updatedAt).toBeDefined();

      const state = store.getState().companion;
      expect(state.companions).toHaveLength(1);
      expect(state.companions[0].name).toBe('New Buddy');
    });

    it('should add a new companion to existing companions', async () => {
      const existingCompanions = [mockCompanion];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(existingCompanions)
      );
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await store.dispatch(addCompanion({userId, payload}) as any);

      const savedData = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      const savedCompanions = JSON.parse(savedData);

      expect(savedCompanions).toHaveLength(2);
      expect(savedCompanions[0]).toEqual(mockCompanion);
      expect(savedCompanions[1].name).toBe('New Buddy');
    });

    it('should handle errors', async () => {
      const errorMessage = 'Storage write error';
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      await store.dispatch(addCompanion({userId, payload}) as any);

      const state = store.getState().companion;
      expect(state.error).toBe(errorMessage);
    });

    it('should handle non-Error exceptions', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue('Some error');

      await store.dispatch(addCompanion({userId, payload}) as any);

      const state = store.getState().companion;
      expect(state.error).toBe('Failed to add companion');
    });
  });

  describe('updateCompanionProfile', () => {
    const updatedCompanion: Companion = {
      ...mockCompanion,
      name: 'Updated Buddy',
      currentWeight: 32,
    };

    it('should update an existing companion', async () => {
      const companions = [mockCompanion, mockCompanion2];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(companions)
      );
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await store.dispatch(
        updateCompanionProfile({userId, updatedCompanion}) as any
      );

      expect(AsyncStorage.getItem).toHaveBeenCalledWith(storageKey);

      const savedData = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      const savedCompanions = JSON.parse(savedData);

      expect(savedCompanions[0].name).toBe('Updated Buddy');
      expect(savedCompanions[0].currentWeight).toBe(32);
      expect(savedCompanions[0].updatedAt).toBeDefined();
      expect(savedCompanions[1]).toEqual(mockCompanion2);

      const state = store.getState().companion;
      expect(state.loading).toBe(false);
    });

    it('should reject when companion not found', async () => {
      const companions = [mockCompanion2];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(companions)
      );

      await store.dispatch(
        updateCompanionProfile({userId, updatedCompanion}) as any
      );

      const state = store.getState().companion;
      expect(state.error).toBe('Companion not found.');
    });

    it('should handle empty storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await store.dispatch(
        updateCompanionProfile({userId, updatedCompanion}) as any
      );

      const state = store.getState().companion;
      expect(state.error).toBe('Companion not found.');
    });

    it('should handle errors', async () => {
      const errorMessage = 'Storage error';
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      await store.dispatch(
        updateCompanionProfile({userId, updatedCompanion}) as any
      );

      const state = store.getState().companion;
      expect(state.error).toBe(errorMessage);
    });

    it('should handle non-Error exceptions', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue('Some error');

      await store.dispatch(
        updateCompanionProfile({userId, updatedCompanion}) as any
      );

      const state = store.getState().companion;
      expect(state.error).toBe('Failed to update companion');
    });
  });

  describe('deleteCompanion', () => {
    const companionId = 'companion_1';

    it('should delete a companion', async () => {
      const companions = [mockCompanion, mockCompanion2];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(companions)
      );
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await store.dispatch(deleteCompanion({userId, companionId}) as any);

      expect(AsyncStorage.getItem).toHaveBeenCalledWith(storageKey);

      const savedData = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      const savedCompanions = JSON.parse(savedData);

      expect(savedCompanions).toHaveLength(1);
      expect(savedCompanions[0]).toEqual(mockCompanion2);

      const state = store.getState().companion;
      expect(state.loading).toBe(false);
    });

    it('should delete the last companion', async () => {
      const companions = [mockCompanion];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(companions)
      );
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await store.dispatch(deleteCompanion({userId, companionId}) as any);

      const savedData = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      const savedCompanions = JSON.parse(savedData);

      expect(savedCompanions).toEqual([]);

      const state = store.getState().companion;
      expect(state.companions).toEqual([]);
    });

    it('should reject when storage is empty', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await store.dispatch(deleteCompanion({userId, companionId}) as any);

      const state = store.getState().companion;
      expect(state.error).toBe('No companions found for this user.');
    });

    it('should reject when companion not found', async () => {
      const companions = [mockCompanion2];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(companions)
      );

      await store.dispatch(deleteCompanion({userId, companionId}) as any);

      const state = store.getState().companion;
      expect(state.error).toBe('Companion not found.');
    });

    it('should handle errors', async () => {
      const errorMessage = 'Storage error';
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      await store.dispatch(deleteCompanion({userId, companionId}) as any);

      const state = store.getState().companion;
      expect(state.error).toBe(errorMessage);
    });

    it('should handle non-Error exceptions', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue('Some error');

      await store.dispatch(deleteCompanion({userId, companionId}) as any);

      const state = store.getState().companion;
      expect(state.error).toBe('Failed to delete companion');
    });
  });
});
