import {createSlice, createAsyncThunk, PayloadAction, nanoid} from '@reduxjs/toolkit';
import type {AppointmentsState, Appointment, AppointmentStatus, Invoice} from './types';
import {mockAppointments, mockInvoices} from './mocks';

// Simulate network latency
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
const toErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export const fetchAppointmentsForCompanion = createAsyncThunk(
  'appointments/fetchForCompanion',
  async ({companionId}: {companionId: string}, {rejectWithValue}) => {
    try {
      await delay(250);
      const items = mockAppointments(companionId);
      // Include invoices for those appointments if any
      const invoices: Invoice[] = mockInvoices;
      return {companionId, items, invoices};
    } catch (error) {
      return rejectWithValue(toErrorMessage(error, 'Unable to fetch appointments'));
    }
  },
);

export const createAppointment = createAsyncThunk(
  'appointments/create',
  async (payload: Omit<Appointment, 'id'|'status'|'createdAt'|'updatedAt'>, {rejectWithValue}) => {
    try {
      await delay(400);
      const now = new Date().toISOString();
      const id = `apt_${nanoid()}`;
      const apt: Appointment = {
        id,
        ...payload,
        status: 'requested',
        createdAt: now,
        updatedAt: now,
      };
      return apt;
    } catch (error) {
      return rejectWithValue(toErrorMessage(error, 'Unable to create appointment'));
    }
  },
);

export const updateAppointmentStatus = createAsyncThunk(
  'appointments/updateStatus',
  async (
    {appointmentId, status}: {appointmentId: string; status: AppointmentStatus},
    {rejectWithValue},
  ) => {
    try {
      await delay(250);
      return {appointmentId, status};
    } catch (error) {
      return rejectWithValue(toErrorMessage(error, 'Unable to update appointment'));
    }
  },
);

export const recordPayment = createAsyncThunk(
  'appointments/recordPayment',
  async ({appointmentId}: {appointmentId: string}, {rejectWithValue}) => {
    try {
      await delay(250);
      return {appointmentId};
    } catch (error) {
      return rejectWithValue(toErrorMessage(error, 'Unable to record payment'));
    }
  },
);

const initialState: AppointmentsState = {
  items: [],
  invoices: [],
  loading: false,
  error: null,
  hydratedCompanions: {},
};

const appointmentsSlice = createSlice({
  name: 'appointments',
  initialState,
  reducers: {
    injectMockAppointments: (
      state,
      action: PayloadAction<{companionId: string; items: Appointment[]; invoices?: Invoice[]}>,
    ) => {
      const {companionId, items, invoices = []} = action.payload;
      state.items = state.items.filter(a => a.companionId !== companionId);
      state.items.push(...items);
      // Merge invoices
      const other = state.invoices.filter(inv => !invoices.some(i => i.id === inv.id));
      state.invoices = [...other, ...invoices];
      state.hydratedCompanions[companionId] = true;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchAppointmentsForCompanion.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAppointmentsForCompanion.fulfilled, (state, action) => {
        state.loading = false;
        const {companionId, items, invoices} = action.payload as any;
        state.items = state.items.filter(a => a.companionId !== companionId);
        state.items.push(...items);
        const remaining = state.invoices.filter(inv => !invoices.some((i: Invoice) => i.id === inv.id));
        state.invoices = [...remaining, ...invoices];
        state.hydratedCompanions[companionId] = true;
      })
      .addCase(fetchAppointmentsForCompanion.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? 'Unable to fetch appointments';
      })
      .addCase(createAppointment.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createAppointment.fulfilled, (state, action) => {
        state.loading = false;
        state.items.push(action.payload);
      })
      .addCase(createAppointment.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? 'Unable to create appointment';
      })
      .addCase(updateAppointmentStatus.fulfilled, (state, action) => {
        const {appointmentId, status} = action.payload as any;
        const apt = state.items.find(a => a.id === appointmentId);
        if (apt) {
          apt.status = status;
          apt.updatedAt = new Date().toISOString();
        }
      })
      .addCase(recordPayment.fulfilled, (state, action) => {
        const {appointmentId} = action.payload as any;
        const apt = state.items.find(a => a.id === appointmentId);
        if (apt) {
          apt.status = 'paid';
          apt.updatedAt = new Date().toISOString();
        }
      });
  },
});

export const {injectMockAppointments} = appointmentsSlice.actions;
export default appointmentsSlice.reducer;
