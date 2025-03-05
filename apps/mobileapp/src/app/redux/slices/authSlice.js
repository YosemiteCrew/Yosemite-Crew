import {createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import {setLoading} from './loadingSlice';
import API from '../../services/API';
import {navigationContainerRef} from '../../../App';
import {showToast} from '../../components/Toast';

const initialState = {
  user: null,
  error: null,
  defaultLang: 'en',
};

export const sign_up = createAsyncThunk(
  'auth/signup',
  async (credentials, {rejectWithValue, dispatch}) => {
    try {
      dispatch(setLoading(true));
      console.log('credentials=>>>', credentials);

      const response = await API({
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        route: `auth/signup`,
        body: credentials,
        method: 'POST',
        // multiPart: true,
      });
      dispatch(setLoading(false));
      console.log('sign_up_response=>>', JSON.stringify(response?.data));
      showToast(response?.data?.status, response?.data?.message);
      if (response.status !== 200) {
        return rejectWithValue(response?.data);
      }

      return response?.data;
    } catch (error) {
      console.log(error);
      return rejectWithValue(error);
    }
  },
);

export const send_otp_sign_in = createAsyncThunk(
  'auth/sendOtp',
  async (credentials, {rejectWithValue, dispatch}) => {
    try {
      dispatch(setLoading(true));
      console.log('credentials=>>>', credentials);

      const response = await API({
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        route: `auth/sendOtp`,
        body: credentials,
        method: 'POST',
        multiPart: false,
      });
      dispatch(setLoading(false));
      console.log('sendOtp_response=>>', JSON.stringify(response));
      showToast(response?.data?.status, response?.data?.message);
      // if (response?.status === 200) {
      //   showToast(1, response?.data?.message);
      // } else {
      //   showToast(0, response?.data?.message);
      // }
      if (response?.status === 200) {
        // navigationContainerRef?.navigate()
      }
      if (response.status !== 200) {
        return rejectWithValue(response?.data);
      }

      return response?.data;
    } catch (error) {
      console.log(error);
      return rejectWithValue(error);
    }
  },
);

export const sign_in = createAsyncThunk(
  'auth/login',
  async (credentials, {rejectWithValue, dispatch}) => {
    try {
      dispatch(setLoading(true));
      console.log('credentials=>>>', credentials);

      const response = await API({
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        route: `auth/login`,
        body: credentials,
        method: 'POST',
        multiPart: false,
      });
      dispatch(setLoading(false));

      console.log('sign_in_response=>>', JSON.stringify(response));
      showToast(response?.data?.status, response?.data?.message);
      if (response.status !== 200) {
        return rejectWithValue(response?.data);
      }

      return response?.data?.userdata;
    } catch (error) {
      console.log(error);
      return rejectWithValue(error);
    }
  },
);
export const confirm_signup = createAsyncThunk(
  'auth/confirmSignup',
  async (credentials, {rejectWithValue, dispatch}) => {
    try {
      dispatch(setLoading(true));
      console.log('credentials=>>>', credentials);

      const response = await API({
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        route: `auth/confirmSignup`,
        body: credentials,
        method: 'POST',
        multiPart: false,
      });
      dispatch(setLoading(false));

      console.log('confirmSignup_response=>>', JSON.stringify(response));
      showToast(response?.data?.status, response?.data?.message);
      if (response.status !== 200) {
        return rejectWithValue(response?.data);
      }

      return response?.data?.userdata;
    } catch (error) {
      console.log(error);
      return rejectWithValue(error);
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: state => {
      state.user = null;
    },
    updateUser: (state, action) => {
      state.user = action?.payload;
    },
    // setAppLangauage: (state, action) => {
    //   state.defaultLang = action.payload;
    // },
    setUserData: (state, action) => {
      state.user = action.payload;
      console.log('action.payload', action.payload);
    },
    setOnBoarding: (state, action) => {
      state.onBoarding = action.payload;
      console.log('setOnBoarding =>', action.payload);
    },
  },
  extraReducers: builder => {
    builder.addCase(sign_in.pending, state => {
      state.loadingUser = true;
    });
    builder.addCase(sign_in.rejected, state => {
      state.loadingUser = false;
    });
    builder.addCase(sign_in.fulfilled, (state, action) => {
      state.loadingUser = false;
      console.log(' extraReducers action.payload: ', action.payload);
      state.user = action.payload;
    });
    builder.addCase(confirm_signup.pending, state => {
      state.loadingUser = true;
    });
    builder.addCase(confirm_signup.rejected, state => {
      state.loadingUser = false;
    });
    builder.addCase(confirm_signup.fulfilled, (state, action) => {
      state.loadingUser = false;
      console.log(' extraReducers action.payload: ', action.payload);
      const mergedData = {
        isSkip: 0,
        ...action.payload,
      };
      state.user = mergedData;
    });
  },
});

export const {logout, updateUser, setAppLangauage, setUserData, setOnBoarding} =
  authSlice.actions;
export default authSlice.reducer;
