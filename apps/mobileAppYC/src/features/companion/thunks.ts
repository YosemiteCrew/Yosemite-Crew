// src/features/companion/thunks.ts
import {createAsyncThunk} from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {AddCompanionPayload, Companion} from './types';

// Mock API delay
const mockDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock API: Fetch companions for the current user
export const fetchCompanions = createAsyncThunk<
  Companion[],
  string,
  {rejectValue: string}
>('companion/fetchCompanions', async (userId, {rejectWithValue}) => {
  try {
    // Simulate API call
    await mockDelay(800);

    // Mock: Retrieve companions from local storage
    // In production, this would be an actual API call
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

// Mock API: Add a new companion
export const addCompanion = createAsyncThunk<
  Companion,
  {userId: string; payload: AddCompanionPayload},
  {rejectValue: string}
>('companion/addCompanion', async ({userId, payload}, {rejectWithValue}) => {
  try {
    console.log('=== Thunk: addCompanion started ===');
    console.log('UserId:', userId);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    // Simulate API call
    await mockDelay(1000);

    // Create companion object
    const newCompanion: Companion = {
      id: `companion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('New companion created:', JSON.stringify(newCompanion, null, 2));

    // Mock: Save to local storage
    // In production, this would be an actual API call
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
