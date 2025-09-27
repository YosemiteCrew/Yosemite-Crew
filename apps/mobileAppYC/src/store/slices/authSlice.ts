// src/store/slices/authSlice.ts - Fixed setTimeout issues
import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {AuthState, User} from '../types';

const initialState: AuthState = {
  isLoggedIn: false,
  user: null,
  token: null,
  isLoading: false,
  error: null,
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
  },
});

export const {clearAuthError, setUser} = authSlice.actions;
export default authSlice.reducer;