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
import {companionApi} from '@/features/companion/services/companionService';
import {loadStoredTokens} from '@/features/auth/services/tokenStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

jest.mock('@/features/companion/services/companionService', () => ({
  companionApi: {
    create: jest.fn(),
    update: jest.fn(),
    getById: jest.fn(),
  },
}));

jest.mock('@/features/auth/services/tokenStorage', () => ({
  loadStoredTokens: jest.fn(),
}));

const createTestStore = () =>
  configureStore({
    reducer: {
      companion: companionReducer,
    },
  });

type TestStore = ReturnType<typeof createTestStore>;

describe('companion thunks', () => {
  let store: TestStore;
  const userId = 'user_123';
  const storageKey = `companions_${userId}`;
  const mockedApi = companionApi as jest.Mocked<typeof companionApi>;
  const loadStoredTokensMock = loadStoredTokens as jest.MockedFunction<typeof loadStoredTokens>;

  const mockCompanion: Companion = {
    id: 'companion_1',
    userId,
    category: 'dog',
    name: 'Buddy',
    breed: null,
    dateOfBirth: '2020-01-15T00:00:00.000Z',
    gender: 'male',
    currentWeight: 20,
    color: 'Brown',
    allergies: null,
    neuteredStatus: 'neutered',
    ageWhenNeutered: '1 year',
    bloodGroup: 'DEA 1.1',
    microchipNumber: '123',
    passportNumber: null,
    insuredStatus: 'insured',
    insuranceCompany: null,
    insurancePolicyNumber: null,
    countryOfOrigin: 'USA',
    origin: 'breeder',
    profileImage: null,
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
    loadStoredTokensMock.mockResolvedValue({accessToken: 'token'});
  });

  describe('fetchCompanions', () => {
    it('returns refreshed companions when storage has entries', async () => {
      const storedCompanions = [mockCompanion];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(storedCompanions),
      );
      mockedApi.getById.mockResolvedValue({
        ...mockCompanion,
        name: 'Updated Buddy',
      });
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await store.dispatch(fetchCompanions(userId) as any);

      expect(mockedApi.getById).toHaveBeenCalledWith({
        companionId: mockCompanion.id,
        userId,
        accessToken: 'token',
        fallback: mockCompanion,
      });
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        storageKey,
        JSON.stringify([
          expect.objectContaining({name: 'Updated Buddy'}),
        ]),
      );
      expect(store.getState().companion.companions[0].name).toBe('Updated Buddy');
    });

    it('returns empty array when storage is empty', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await store.dispatch(fetchCompanions(userId) as any);

      expect(mockedApi.getById).not.toHaveBeenCalled();
      expect(store.getState().companion.companions).toEqual([]);
    });

    it('sets error when storage read fails', async () => {
      const errorMessage = 'read failure';
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error(errorMessage));

      await store.dispatch(fetchCompanions(userId) as any);

      expect(store.getState().companion.error).toBe(errorMessage);
    });
  });

  describe('addCompanion', () => {
    const payload: AddCompanionPayload = {
      category: 'dog',
      name: 'New Buddy',
      breed: null,
      dateOfBirth: '2023-01-01T00:00:00.000Z',
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

    it('saves the created companion locally', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      mockedApi.create.mockResolvedValue({
        ...mockCompanion,
        id: 'server-id',
        name: payload.name,
      });

      await store.dispatch(addCompanion({userId, payload}) as any);

      expect(loadStoredTokensMock).toHaveBeenCalled();
      expect(mockedApi.create).toHaveBeenCalledWith({
        userId,
        payload,
        accessToken: 'token',
      });
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        storageKey,
        JSON.stringify([
          expect.objectContaining({id: 'server-id', name: payload.name}),
        ]),
      );
      expect(store.getState().companion.companions[0].id).toBe('server-id');
    });

    it('handles API failures gracefully', async () => {
      mockedApi.create.mockRejectedValue(new Error('api failure'));

      await store.dispatch(addCompanion({userId, payload}) as any);

      expect(store.getState().companion.error).toBe('api failure');
    });

    it('rejects when access token is missing', async () => {
      loadStoredTokensMock.mockResolvedValue({accessToken: undefined as any});

      await store.dispatch(addCompanion({userId, payload}) as any);

      expect(store.getState().companion.error).toBe(
        'Missing access token. Please sign in again.',
      );
    });
  });

  describe('updateCompanionProfile', () => {
    it('updates the companion and persists changes', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([mockCompanion]),
      );
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      const updated = {...mockCompanion, name: 'Remote Name'};
      mockedApi.update.mockResolvedValue(updated);

      await store.dispatch(
        updateCompanionProfile({userId, updatedCompanion: updated}) as any,
      );

      expect(mockedApi.update).toHaveBeenCalled();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        storageKey,
        JSON.stringify([updated]),
      );
      expect(store.getState().companion.companions[0].name).toBe('Remote Name');
    });

    it('captures API errors', async () => {
      mockedApi.update.mockRejectedValue(new Error('update failed'));

      await store.dispatch(
        updateCompanionProfile({userId, updatedCompanion: mockCompanion}) as any,
      );

      expect(store.getState().companion.error).toBe('update failed');
    });
  });

  describe('deleteCompanion', () => {
    it('removes the requested companion', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([
          mockCompanion,
          {...mockCompanion, id: 'two', name: 'Second'},
        ]),
      );
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      await store.dispatch(deleteCompanion({userId, companionId: 'two'}) as any);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        storageKey,
        JSON.stringify([mockCompanion]),
      );
      expect(store.getState().companion.companions.length).toBe(1);
    });

    it('rejects when the companion cannot be found', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([mockCompanion]),
      );

      const result = await store.dispatch(
        deleteCompanion({userId, companionId: 'missing'}) as any,
      );

      expect(result.type).toContain('rejected');
      expect(store.getState().companion.error).toBe('Companion not found.');
    });

    it('propagates storage errors', async () => {
      const errorMessage = 'read failed';
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error(errorMessage),
      );

      await store.dispatch(deleteCompanion({userId, companionId: 'one'}) as any);

      expect(store.getState().companion.error).toBe(errorMessage);
    });
  });
});
