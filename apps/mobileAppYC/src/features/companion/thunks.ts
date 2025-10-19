// src/features/companion/thunks.ts
import {createAsyncThunk} from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {AddCompanionPayload, Companion} from './types';
import {generateId} from '@/utils/helpers';

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
      id: `companion_${Date.now()}_${generateId()}`,
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

// Mock API: Update existing companion
export const updateCompanionProfile = createAsyncThunk<
  Companion,
  {userId: string; updatedCompanion: Companion},
  {rejectValue: string}
>('companion/updateCompanion', async ({userId, updatedCompanion}, {rejectWithValue}) => {
  try {
    console.log('=== Thunk: updateCompanionProfile started ===');
    console.log('UserId:', userId);
    console.log('Updated Companion:', JSON.stringify(updatedCompanion, null, 2));

    // Simulate API latency
    await mockDelay(600);

    // Retrieve existing companions
    const stored = await AsyncStorage.getItem(`companions_${userId}`);
    const companions: Companion[] = stored ? JSON.parse(stored) : [];

    const index = companions.findIndex(c => c.id === updatedCompanion.id);
    if (index === -1) {
      return rejectWithValue('Companion not found.');
    }

    // Update companion in the array
    companions[index] = {
      ...companions[index],
      ...updatedCompanion,
      updatedAt: new Date().toISOString(),
    };

    // Save back to AsyncStorage
    await AsyncStorage.setItem(`companions_${userId}`, JSON.stringify(companions));

    console.log('Companion updated successfully in AsyncStorage');
    return companions[index];
  } catch (error) {
    console.error('updateCompanionProfile error:', error);
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to update companion',
    );
  }
});


export const deleteCompanion = createAsyncThunk<
  string, // Return the ID of the deleted companion on success
  {userId: string; companionId: string},
  {rejectValue: string}
>('companion/deleteCompanion', async ({userId, companionId}, {rejectWithValue}) => {
  try {
    // Simulate API call
    await mockDelay(800);

    // Mock: Remove from local storage
    const stored = await AsyncStorage.getItem(`companions_${userId}`);
    if (!stored) {
      throw new Error('No companions found for this user.');
    }

    let companions: Companion[] = JSON.parse(stored);
    const initialLength = companions.length;

    companions = companions.filter(c => c.id !== companionId);

    if (companions.length === initialLength) {
      // Companion with the given ID was not found
      return rejectWithValue('Companion not found.');
    }

    await AsyncStorage.setItem(`companions_${userId}`, JSON.stringify(companions));

    return companionId; // Return the deleted ID
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to delete companion',
    );
  }
});
