import {createSlice} from '@reduxjs/toolkit';
import {makeThunk} from './thunks';

const initialState = {
  user: null,
  error: null,
  defaultLang: 'en',
  showWelcome: true,
};

export const sign_up = makeThunk('auth/signup', 'auth/signup', {
  method: 'POST',
  multiPart: true,
  onSuccess: res => showToast(res?.data?.status, res?.data?.message),
});

export const send_otp_sign_in = makeThunk('auth/sendOtp', 'auth/sendOtp', {
  method: 'POST',
  formUrl: true,
  onSuccess: res => showToast(res?.data?.status, res?.data?.message),
});

export const sign_in = makeThunk('auth/login', 'auth/login', {
  method: 'POST',
  onSuccess: res => showToast(res?.data?.status, res?.data?.message),
});

export const confirm_signup = makeThunk(
  'auth/confirmSignup',
  'auth/confirmSignup',
  {
    method: 'POST',
    onSuccess: res => showToast(res?.data?.status, res?.data?.message),
  },
);

export const resend_otp = makeThunk(
  'auth/resendConfirmationCode',
  'auth/resendConfirmationCode',
  {
    method: 'POST',
    onSuccess: res => showToast(res?.data?.status, res?.data?.message),
  },
);

export const logout_user = makeThunk('auth/logout', 'auth/logout', {
  method: 'POST',
  onSuccess: (res, {dispatch}) => {
    if (res?.data?.status === 1) {
      dispatch(logout());
      dispatch(updatePetList([]));
    }
  },
});

export const social_login = makeThunk(
  'auth/social-login',
  'auth/social-login',
  {
    method: 'POST',
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: s => {
      s.user = null;
      s.showWelcome = true;
    },
    updateUser: (s, a) => {
      s.user = a.payload;
    },
    setUserData: (s, a) => {
      s.user = a.payload;
    },
    setOnBoarding: (s, a) => {
      s.onBoarding = a.payload;
    },
    setShowWelcome: (s, a) => {
      s.showWelcome = a.payload;
    },
  },
  extraReducers: b => {
    b.addMatcher(
      a => a.type.endsWith('/pending'),
      s => {
        s.loadingUser = true;
      },
    )
      .addMatcher(
        a => a.type.endsWith('/rejected'),
        s => {
          s.loadingUser = false;
        },
      )
      .addMatcher(
        a => a.type.endsWith('/fulfilled'),
        (s, {type, payload}) => {
          s.loadingUser = false;
          if (type === confirm_signup.fulfilled.type && payload?.status === 1) {
            s.user = {isSkip: 0, ...payload.userdata};
          }
        },
      );
  },
});

export const {logout, updateUser, setUserData, setOnBoarding, setShowWelcome} =
  authSlice.actions;
export default authSlice.reducer;
