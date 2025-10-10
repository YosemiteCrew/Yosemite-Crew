// src/store/slices/authSlice.ts - Fixed setTimeout issues
import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {AuthState, User} from '../types';
import {
  fetchProfileStatus,
  type ProfileStatusRequest,
} from '@/services/profile/profileService';

const initialState: AuthState = {
  isLoggedIn: false,
  user: null,
  token: null,
  isLoading: false,
  error: null,
  profileExists: null,
  profileToken: null,
  profileStatusSource: null,
};

// Async thunks for authentication
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials: {email: string; password: string}) => {
    // Simulate API call - Fixed resolve parameter
    await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));
    
    // Mock user data
    const user: User = {
      id: '1',
      email: credentials.email,
      name: 'Harshit Wandhare',
      avatar: 'https://picsum.photos/100/100',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const token = 'mock-jwt-token';
    return {user, token};
  },
);

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async (userData: {email: string; password: string; name: string}) => {
    // Simulate API call - Fixed resolve parameter
    await new Promise<void>(resolve => setTimeout(() => resolve(), 1500));
    
    // Mock user data
    const user: User = {
      id: '1',
      email: userData.email,
      name: userData.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const token = 'mock-jwt-token';
    return {user, token};
  },
);

export const logoutUser = createAsyncThunk('auth/logoutUser', async () => {
  // Simulate API call - Fixed resolve parameter
  await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
  return;
});

export const fetchProfileStatusThunk = createAsyncThunk(
  'auth/fetchProfileStatus',
  async (payload: ProfileStatusRequest) => {
    const status = await fetchProfileStatus(payload);
    return status;
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthError: state => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
  },
  extraReducers: builder => {
    // Login
    builder.addCase(loginUser.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(loginUser.fulfilled, (state, action) => {
      state.isLoading = false;
      state.isLoggedIn = true;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.error = null;
      state.profileExists = null;
      state.profileToken = null;
      state.profileStatusSource = null;
    });
    builder.addCase(loginUser.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.error.message || 'Login failed';
    });

    // Register
    builder.addCase(registerUser.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(registerUser.fulfilled, (state, action) => {
      state.isLoading = false;
      state.isLoggedIn = true;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.error = null;
      state.profileExists = null;
      state.profileToken = null;
      state.profileStatusSource = null;
    });
    builder.addCase(registerUser.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.error.message || 'Registration failed';
    });

    // Logout
    builder.addCase(logoutUser.pending, state => {
      state.isLoading = true;
    });
    builder.addCase(logoutUser.fulfilled, () => {
      return initialState;
    });
    builder.addCase(logoutUser.rejected, state => {
      state.isLoading = false;
    });

    // Profile status
    builder.addCase(fetchProfileStatusThunk.pending, state => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchProfileStatusThunk.fulfilled, (state, action) => {
      state.isLoading = false;
      state.profileExists = action.payload.exists;
      state.profileToken = action.payload.profileToken;
      state.profileStatusSource = action.payload.source;
    });
    builder.addCase(fetchProfileStatusThunk.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.error.message || 'Profile status lookup failed';
    });
  },
});

export const {clearAuthError, setUser} = authSlice.actions;
export default authSlice.reducer;
