import {createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import {setLoading} from './loadingSlice';
import API from '../../services/API';
import {showToast} from '../../components/Toast';

const makeThunk = (
  type,
  route,
  {method = 'POST', multiPart = false, headers, onSuccess} = {},
) =>
  createAsyncThunk(type, async (data, {dispatch, rejectWithValue}) => {
    try {
      dispatch(setLoading(true));
      const res = await API({
        route: typeof route === 'function' ? route(data) : route,
        method,
        body: data,
        multiPart,
        headers: headers || {'Content-Type': 'multipart/form-data'},
      });
      dispatch(setLoading(false));

      if (onSuccess) onSuccess(res, dispatch, data);
      if (res?.status !== 200 && res?.data?.status !== 1) {
        return rejectWithValue(res?.data);
      }
      return res?.data;
    } catch (err) {
      dispatch(setLoading(false));
      return rejectWithValue(err.response?.data || err);
    }
  });

// ✅ Thunks
export const get_vaccine_records = makeThunk(
  'vaccineSlice/getVaccinationRecord',
  'getVaccinationRecord',
  {method: 'GET', headers: {}},
);

export const add_vaccine_records = makeThunk(
  'vaccineSlice/addVaccinationRecord',
  'Immunization/addVaccinationRecord',
  {
    method: 'POST',
    multiPart: true,
    onSuccess: res => showToast(res?.data?.status, res?.data?.message),
  },
);

export const edit_vaccine_records = makeThunk(
  'vaccineSlice/editVaccinationRecord',
  d => `Immunization/editVaccinationRecord?recordId=${d?.vaccinationRecordId}`,
  {
    method: 'PUT',
    multiPart: true,
    onSuccess: res => showToast(res?.data?.status, res?.data?.message),
  },
);

export const delete_vaccine_record_api = makeThunk(
  'vaccineSlice/deleteVaccinationRecord',
  d =>
    `Immunization/deleteVaccinationRecord?recordId=${d?.vaccinationRecordId}`,
  {
    method: 'DELETE',
    onSuccess: res => {
      if (res?.data?.status === 1) showToast(1, res?.data?.message);
    },
  },
);

// ✅ Slice (in case you need local state)
const vaccineSlice = createSlice({
  name: 'vaccine',
  initialState: {list: [], loading: false, error: null},
  reducers: {},
  extraReducers: builder => {
    builder
      .addMatcher(
        a => a.type.endsWith('/pending'),
        s => {
          s.loading = true;
        },
      )
      .addMatcher(
        a => a.type.endsWith('/rejected'),
        (s, a) => {
          s.loading = false;
          s.error = a.payload;
        },
      )
      .addMatcher(
        a => a.type.endsWith('/fulfilled'),
        s => {
          s.loading = false;
        },
      );
  },
});

export default vaccineSlice.reducer;
