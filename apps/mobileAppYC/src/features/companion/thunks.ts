// src/features/companion/thunks.ts
import {createAsyncThunk} from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {AddCompanionPayload, Companion} from './types';
import {companionApi} from './services/companionService';
import {loadStoredTokens} from '@/features/auth/services/tokenStorage';

const buildStorageKey = (userId: string) => `companions_${userId}`;

const readCompanionsFromStorage = async (userId: string): Promise<Companion[]> => {
  const key = buildStorageKey(userId);
  const stored = await AsyncStorage.getItem(key);

  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as Companion[];
  } catch (error) {
    console.warn('[Companion] Failed to parse companions from storage', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to read companions from storage');
  }
};

const writeCompanionsToStorage = async (
  userId: string,
  companions: Companion[],
): Promise<void> => {
  const key = buildStorageKey(userId);
  await AsyncStorage.setItem(key, JSON.stringify(companions));
};

const ensureAccessToken = async (): Promise<string> => {
  const tokens = await loadStoredTokens();
  const accessToken = tokens?.accessToken;

  if (!accessToken) {
    throw new Error('Missing access token. Please sign in again.');
  }

  return accessToken;
};

export const fetchCompanions = createAsyncThunk<
  Companion[],
  string,
  {rejectValue: string}
>('companion/fetchCompanions', async (userId, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    const remoteCompanions = await companionApi.listByParent({
      userId,
      accessToken,
    });
    await writeCompanionsToStorage(userId, remoteCompanions);
    return remoteCompanions;
  } catch (error) {
    console.warn('[Companion] Remote fetch failed, attempting cached data', error);
    try {
      const cached = await readCompanionsFromStorage(userId);
      if (cached.length > 0) {
        return cached;
      }
    } catch (cacheError) {
      console.warn('[Companion] Unable to read cached companions', cacheError);
    }

    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to fetch companions',
    );
  }
});

export const addCompanion = createAsyncThunk<
  Companion,
  {userId: string; payload: AddCompanionPayload},
  {rejectValue: string}
>('companion/addCompanion', async ({userId, payload}, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    const created = await companionApi.create({userId, payload, accessToken});
    const companions = await readCompanionsFromStorage(userId);
    companions.push(created);
    await writeCompanionsToStorage(userId, companions);
    return created;
  } catch (error) {
    console.error('[Companion] addCompanion failed', error);
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to add companion',
    );
  }
});

export const updateCompanionProfile = createAsyncThunk<
  Companion,
  {userId: string; updatedCompanion: Companion},
  {rejectValue: string}
>('companion/updateCompanion', async ({userId, updatedCompanion}, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    const updated = await companionApi.update({
      companion: updatedCompanion,
      accessToken,
    });

    const companions = await readCompanionsFromStorage(userId);
    const index = companions.findIndex(c => c.id === updated.id);

    if (index === -1) {
      companions.push(updated);
    } else {
      companions[index] = updated;
    }

    await writeCompanionsToStorage(userId, companions);
    return updated;
  } catch (error) {
    console.error('[Companion] updateCompanionProfile failed', error);
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to update companion',
    );
  }
});

export const deleteCompanion = createAsyncThunk<
  string,
  {userId: string; companionId: string},
  {rejectValue: string}
>('companion/deleteCompanion', async ({userId, companionId}, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    await companionApi.remove({companionId, accessToken});
    const companions = await readCompanionsFromStorage(userId);
    const next = companions.filter(c => c.id !== companionId);

    if (next.length === companions.length) {
      return rejectWithValue('Companion not found.');
    }

    await writeCompanionsToStorage(userId, next);
    return companionId;
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to delete companion',
    );
  }
});
