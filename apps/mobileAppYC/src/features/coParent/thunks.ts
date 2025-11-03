import {createAsyncThunk} from '@reduxjs/toolkit';
import type {CoParent, CoParentInviteRequest, CoParentPermissions} from './types';
import {MOCK_CO_PARENTS, MOCK_SEARCHABLE_CO_PARENTS} from './mockData';

// Mock API call for fetching co-parents for current user
export const fetchCoParents = createAsyncThunk(
  'coParent/fetchCoParents',
  async (userId: string, {rejectWithValue, getState}) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock: Return co-parents filtered by userId
      const mockCoParents = MOCK_CO_PARENTS.filter(cp => cp.userId === userId);

      // Get current state to preserve any locally added co-parents that haven't synced to backend yet
      const state = getState() as any;
      const currentCoParents = state.coParent?.coParents || [];

      // Merge: keep locally added co-parents (those with pending status) and add mock data
      const locallyAdded = currentCoParents.filter((cp: CoParent) => cp.status === 'pending');
      const merged = [
        ...mockCoParents,
        ...locallyAdded.filter((local: CoParent) => !mockCoParents.find(mock => mock.id === local.id))
      ];

      return merged;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch co-parents');
    }
  },
);

// Add co-parent (mock API call)
export const addCoParent = createAsyncThunk(
  'coParent/addCoParent',
  async (
    {
      userId,
      inviteRequest,
    }: {userId: string; inviteRequest: CoParentInviteRequest},
    {rejectWithValue},
  ) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));

      // Mock: Create new co-parent
      const newCoParent: CoParent = {
        id: `cp_${Date.now()}`,
        userId,
        email: inviteRequest.email,
        firstName: inviteRequest.candidateName.split(' ')[0],
        lastName: inviteRequest.candidateName.split(' ')[1] || '',
        phoneNumber: inviteRequest.phoneNumber,
        companions: [],
        permissions: {
          assignAsPrimaryParent: true,
          emergencyBasedPermissions: true,
          appointments: true,
          companionProfile: false,
          documents: false,
          expenses: true,
          tasks: false,
          chatWithVet: false,
        },
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return newCoParent;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to add co-parent');
    }
  },
);

// Update co-parent permissions
export const updateCoParentPermissions = createAsyncThunk(
  'coParent/updateCoParentPermissions',
  async (
    {coParentId, permissions}: {coParentId: string; permissions: CoParentPermissions},
    {rejectWithValue, getState},
  ) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 600));

      // Check Redux state first (for locally added co-parents)
      const state = getState() as any;
      const currentCoParents = state.coParent?.coParents || [];
      const coParentInState = currentCoParents.find((cp: CoParent) => cp.id === coParentId);

      // Fall back to mock data if not in Redux state
      const coParent = coParentInState || MOCK_CO_PARENTS.find(cp => cp.id === coParentId);
      if (!coParent) {
        throw new Error('Co-parent not found');
      }

      const updated: CoParent = {
        ...coParent,
        permissions,
        updatedAt: new Date().toISOString(),
      };

      return updated;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update permissions');
    }
  },
);

// Delete co-parent
export const deleteCoParent = createAsyncThunk(
  'coParent/deleteCoParent',
  async (coParentId: string, {rejectWithValue, getState}) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 600));

      // Check if co-parent exists in current state first (for locally added co-parents)
      const state = getState() as any;
      const currentCoParents = state.coParent?.coParents || [];
      const coParentInState = currentCoParents.find(cp => cp.id === coParentId);

      // Fall back to mock data
      const coParent = coParentInState || MOCK_CO_PARENTS.find(cp => cp.id === coParentId);
      if (!coParent) {
        throw new Error('Co-parent not found');
      }

      return coParentId;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete co-parent');
    }
  },
);

// Search co-parents by email
export const searchCoParentsByEmail = createAsyncThunk(
  'coParent/searchCoParentsByEmail',
  async (email: string, {rejectWithValue}) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 400));

      // Mock: Search in mock data
      const results = MOCK_SEARCHABLE_CO_PARENTS.filter(
        (cp: CoParent) => cp.email.toLowerCase().includes(email.toLowerCase()),
      );

      return results;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to search co-parents');
    }
  },
);
