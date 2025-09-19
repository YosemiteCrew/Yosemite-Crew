import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { makeThunk } from './thunks';
import { updatePetList } from './petSlice';
import { User } from '../../types/api';
import { showToast } from '../../components/Toast';

interface AuthState {
  user: User | null;
  error: any | null;
  defaultLang: 'en';
  showWelcome: boolean;
  onBoarding: boolean;
  loadingUser?: boolean;
}

const initialState: AuthState = {
  user: null,
  error: null,
  defaultLang: 'en',
  showWelcome: true,
  onBoarding: false,
};

interface AuthResponse {
  status: number;
  message: string;
  user?: User;
  userdata?: User;
}

export const sign_up = makeThunk<AuthResponse, FormData>('auth/signup', 'auth/signup', {
  method: 'POST',
  multiPart: true,
  showToastMessage: true,
});

export const send_otp_sign_in = makeThunk<{ status: number; message: string }, { email: string }>('auth/sendOtp', 'auth/sendOtp', {
  method: 'POST',
  formUrl: true,
});

export const sign_in = makeThunk<AuthResponse, any>('auth/login', 'auth/login', {
  method: 'POST',
  showToastMessage: true,
});

export const confirm_signup = makeThunk<AuthResponse, any>('auth/confirmSignup', 'auth/confirmSignup', {
  method: 'POST',
});

export const resend_otp = makeThunk<any, any>('auth/resendConfirmationCode', 'auth/resendConfirmationCode', {
  method: 'POST',
  onSuccess: res => showToast(res?.status, res?.message),
});

export const logout_user = makeThunk<any, { deviceToken: string }>('auth/logout', 'auth/logout', {
  method: 'POST',
  showToastMessage: false,
  onSuccess: (res, dispatch) => {
    if (res?.status === 1) {
      dispatch(logout());
      dispatch(updatePetList([]));
    }
  },
});

export const social_login = makeThunk<AuthResponse, any>('auth/social-login', 'auth/social-login', {
  method: 'POST',
});

export const edi_user_profile = makeThunk<AuthResponse, FormData>('auth/updateProfileDetail', 'auth/updateProfileDetail', {
  method: 'PUT',
  multiPart: true,
});

export const delete_user_account = makeThunk<any, any>('auth/deleteAccountWithToken', 'auth/deleteAccountWithToken', {
  method: 'POST',
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
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
        state => { state.loadingUser = true; }
      )
      .addMatcher(
        action => action.type.endsWith('/rejected'),
        state => { state.loadingUser = false; }
      )
      .addMatcher(
        action => action.type.endsWith('/fulfilled'),
        (state, action: PayloadAction<AuthResponse>) => {
          state.loadingUser = false;
          if (confirm_signup.fulfilled.match(action) && action.payload?.status === 1) {
            state.user = { isSkip: 0, ...action.payload.userdata } as User;
          }
          if ((sign_in.fulfilled.match(action) || social_login.fulfilled.match(action)) && action.payload?.status === 1) {
            state.user = action.payload.user as User;
          }
        },
      );
  },
});

export const { logout, updateUser, setUserData, setOnBoarding, setShowWelcome } = authSlice.actions;
export default authSlice.reducer;