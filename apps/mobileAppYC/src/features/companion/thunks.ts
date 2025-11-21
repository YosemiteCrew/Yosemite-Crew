// src/features/companion/thunks.ts
import {createAsyncThunk} from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {AddCompanionPayload, Companion} from './types';
import {companionApi} from './services/companionService';
import {loadStoredTokens} from '@/features/auth/services/tokenStorage';

const buildStorageKey = (parentId: string) => `companions_${parentId}`;

const normalizeCompanion = (companion: any): Companion => {
  const fallbackId =
    companion?.id ??
    companion?._id ??
    companion?.companionId ??
    companion?.userId ??
    companion?.identifier?.[0]?.value ??
    companion?.name ??
    '';

  return {
    ...companion,
    id: fallbackId,
  } as Companion;
};

const readCompanionsFromStorage = async (parentId: string): Promise<Companion[]> => {
  const key = buildStorageKey(parentId);
  const stored = await AsyncStorage.getItem(key);

  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as Companion[];
    return parsed.map(normalizeCompanion);
  } catch (error) {
    console.warn('[Companion] Failed to parse companions from storage', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to read companions from storage');
  }
};

const writeCompanionsToStorage = async (
  parentId: string,
  companions: Companion[],
): Promise<void> => {
  const key = buildStorageKey(parentId);
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
>('companion/fetchCompanions', async (parentId, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    const remoteCompanions = await companionApi.listByParent({
      parentId,
      accessToken,
    });
    const normalized = remoteCompanions.map(normalizeCompanion);
    await writeCompanionsToStorage(parentId, normalized);
    return normalized;
  } catch (error) {
    console.warn('[Companion] Remote fetch failed, attempting cached data', error);
    try {
      const cached = await readCompanionsFromStorage(parentId);
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
  {parentId: string; payload: AddCompanionPayload},
  {rejectValue: string}
>('companion/addCompanion', async ({parentId, payload}, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    const created = normalizeCompanion(
      await companionApi.create({parentId, payload, accessToken}),
    );
    const companions = await readCompanionsFromStorage(parentId);
    companions.push(created);
    await writeCompanionsToStorage(parentId, companions);
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
  {parentId: string; updatedCompanion: Companion},
  {rejectValue: string}
>('companion/updateCompanion', async ({parentId, updatedCompanion}, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    const updated = normalizeCompanion(await companionApi.update({
      companion: updatedCompanion,
      accessToken,
    }));

    const companions = await readCompanionsFromStorage(parentId);
    const index = companions.findIndex(c => c.id === updated.id);

    if (index === -1) {
      companions.push(updated);
    } else {
      companions[index] = updated;
    }

    await writeCompanionsToStorage(parentId, companions);
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
  {parentId: string; companionId: string},
  {rejectValue: string}
>('companion/deleteCompanion', async ({parentId, companionId}, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessToken();
    await companionApi.remove({companionId, accessToken});
    const companions = await readCompanionsFromStorage(parentId);
    const next = companions.filter(c => c.id !== companionId);

    if (next.length === companions.length) {
      return rejectWithValue('Companion not found.');
    }

    await writeCompanionsToStorage(parentId, next);
    return companionId;
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to delete companion',
    );
  }
});
