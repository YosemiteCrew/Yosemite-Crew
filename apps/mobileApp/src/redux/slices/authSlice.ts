// src/redux/slices/authSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { makeThunk } from './thunks';
import { updatePetList } from './petSlice';
import { User } from '../../types/api'; // Import your new User type
import { showToast } from '../../components/Toast';

// 1. Define the interface for the Auth state
interface AuthState {
  user: User | null;
  error: any | null;
  defaultLang: 'en'; // Or use a union type like 'en' | 'es'
  showWelcome: boolean;
  onBoarding: boolean;
  loadingUser?: boolean;
}

// 2. Type the initial state
const initialState: AuthState = {
  user: null,
  error: null,
  defaultLang: 'en',
  showWelcome: true,
  onBoarding: false,
};

// Note: For full type safety, you would define the return types
// and argument types for each thunk, like this:
// export const sign_in = makeThunk<LoginResponse, LoginCredentials>('auth/login', ...);
// For now, we'll use `any` to get it working quickly.

export const sign_up = makeThunk<any, any>('auth/signup', 'auth/signup', {
  method: 'POST',
  multiPart: true,
  showToastMessage: true,
});

export const send_otp_sign_in = makeThunk<any, any>('auth/sendOtp', 'auth/sendOtp', {
  method: 'POST',
  formUrl: true,
});

export const sign_in = makeThunk<any, any>('auth/login', 'auth/login', {
  method: 'POST',
  showToastMessage: true,
});

export const confirm_signup = makeThunk<any, any>('auth/confirmSignup','auth/confirmSignup', {
    method: 'POST',
});

export const resend_otp = makeThunk<any, any>('auth/resendConfirmationCode','auth/resendConfirmationCode',{
    method: 'POST',
    onSuccess: res => showToast(res?.status, res?.message),
});

export const logout_user = makeThunk<any, any>('auth/logout', 'auth/logout', {
  method: 'POST',
  showToastMessage: false,
  onSuccess: (res, dispatch) => {
    if (res?.status === 1) {
      dispatch(logout());
      dispatch(updatePetList([]));
    }
  },
});

export const social_login = makeThunk<any, any>('auth/social-login','auth/social-login',{
    method: 'POST',
});

export const edi_user_profile = makeThunk<any, any>('auth/updateProfileDetail','auth/updateProfileDetail',{
    method: 'PUT',
    multiPart: true,
});

export const delete_user_account = makeThunk<any, any>('auth/deleteAccountWithToken','auth/deleteAccountWithToken',{
    method: 'POST',
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  // 3. Use PayloadAction to type your reducers
  reducers: {
    logout: state => {
      state.user = null;
      state.showWelcome = true;
    },
    updateUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
    },
    setUserData: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
    },
    setOnBoarding: (state, action: PayloadAction<boolean>) => {
      state.onBoarding = action.payload;
    },
    setShowWelcome: (state, action: PayloadAction<boolean>) => {
      state.showWelcome = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addMatcher(
        action => action.type.endsWith('/pending'),
        state => {
          state.loadingUser = true;
        },
      )
      .addMatcher(
        action => action.type.endsWith('/rejected'),
        state => {
          state.loadingUser = false;
        },
      )
      .addMatcher(
        action => action.type.endsWith('/fulfilled'),
        (state, action: PayloadAction<any>) => {
          state.loadingUser = false;
          if (confirm_signup.fulfilled.match(action) && action.payload?.status === 1) {
            // Assuming payload.userdata matches the User type
            state.user = { isSkip: 0, ...action.payload.userdata };
          }
          // Add other specific fulfilled matchers here, for example:
          if (sign_in.fulfilled.match(action) && action.payload?.status === 1) {
            state.user = action.payload.user; // Or action.payload.data.user
          }
        },
      );
  },
});

export const { logout, updateUser, setUserData, setOnBoarding, setShowWelcome } =
  authSlice.actions;
export default authSlice.reducer;