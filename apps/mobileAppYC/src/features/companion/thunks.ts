import {createAsyncThunk} from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {AddCompanionPayload, Companion} from './types';

const mockDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchCompanions = createAsyncThunk<
  Companion[],
  string,
  {rejectValue: string}
>('companion/fetchCompanions', async (userId, {rejectWithValue}) => {
  try {
    await mockDelay(800);

    const stored = await AsyncStorage.getItem(`companions_${userId}`);

    if (stored) {
      return JSON.parse(stored) as Companion[];
    }

    return [];
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to fetch companions'
    );
  }
});

export const addCompanion = createAsyncThunk<
  Companion,
  {userId: string; payload: AddCompanionPayload},
  {rejectValue: string}
>('companion/addCompanion', async ({userId, payload}, {rejectWithValue}) => {
  try {
    console.log('=== Thunk: addCompanion started ===');
    console.log('UserId:', userId);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    await mockDelay(1000);

    const newCompanion: Companion = {
      id: `companion_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId,
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('New companion created:', JSON.stringify(newCompanion, null, 2));

    const stored = await AsyncStorage.getItem(`companions_${userId}`);
    const companions: Companion[] = stored ? JSON.parse(stored) : [];
    companions.push(newCompanion);
    await AsyncStorage.setItem(`companions_${userId}`, JSON.stringify(companions));

    console.log('Companion saved to AsyncStorage');
    console.log('Total companions:', companions.length);

    return newCompanion;
  } catch (error) {
    console.error('Thunk error:', error);
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to add companion'
    );
  }
});
