import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import type {
  AppointmentsState,
  Appointment,
  AppointmentStatus,
  Invoice,
  PaymentIntentInfo,
} from './types';
import {appointmentApi} from './services/appointmentsService';
import {getFreshStoredTokens, isTokenExpired} from '@/features/auth/sessionManager';
import type {RootState} from '@/app/store';

const toErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const ensureAccessToken = async (): Promise<string> => {
  const tokens = await getFreshStoredTokens();
  const accessToken = tokens?.accessToken;

  if (!accessToken) {
    throw new Error('Missing access token. Please sign in again.');
  }

  if (isTokenExpired(tokens?.expiresAt ?? undefined)) {
    throw new Error('Your session expired. Please sign in again.');
  }

  return accessToken;
};

type BookAppointmentInput = {
  businessId: string;
  serviceId: string;
  serviceName: string;
  specialityId?: string | null;
  specialityName?: string | null;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  concern?: string;
  emergency?: boolean;
  companionId: string;
  attachments?: Array<{key: string; name?: string | null; contentType?: string | null}>;
};

export const fetchAppointmentsForCompanion = createAsyncThunk(
  'appointments/fetchForCompanion',
  async ({companionId}: {companionId: string}, {rejectWithValue}) => {
    try {
      const accessToken = await ensureAccessToken();
      const items = await appointmentApi.listAppointments({companionId, accessToken});
      return {companionId, items};
    } catch (error) {
      console.warn('[Appointments] fetchAppointmentsForCompanion failed', error);
      return rejectWithValue(toErrorMessage(error, 'Unable to fetch appointments'));
    }
  },
);

export const fetchAppointmentById = createAsyncThunk(
  'appointments/fetchById',
  async ({appointmentId}: {appointmentId: string}, {rejectWithValue}) => {
    try {
      const accessToken = await ensureAccessToken();
      const appointment = await appointmentApi.getAppointment({appointmentId, accessToken});
      return appointment;
    } catch (error) {
      return rejectWithValue(toErrorMessage(error, 'Unable to load appointment'));
    }
  },
);

export const createAppointment = createAsyncThunk<
  {appointment: Appointment; invoice: Invoice | null; paymentIntent: PaymentIntentInfo | null},
  BookAppointmentInput,
  {state: RootState}
>('appointments/create', async (payload, {rejectWithValue, getState}) => {
  try {
    const accessToken = await ensureAccessToken();
    const state = getState();
    const companion = state.companion.companions.find(c => c.id === payload.companionId);
    const user = state.auth.user;

    const startISO = new Date(`${payload.date}T${payload.startTime}:00Z`).toISOString();
    const endISO = payload.endTime
      ? new Date(`${payload.date}T${payload.endTime}:00Z`).toISOString()
      : new Date(new Date(startISO).getTime() + 15 * 60 * 1000).toISOString();
    const minutesDuration = Math.max(
      1,
      Math.round((new Date(endISO).getTime() - new Date(startISO).getTime()) / 60000),
    );

    const attachmentExtensions =
      payload.attachments?.length
        ? payload.attachments
            .filter(att => att.key)
            .map(att => ({
              url: 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-attachments',
              extension: [
                {url: 'key', valueString: att.key},
                {url: 'name', valueString: att.name ?? att.key},
                ...(att.contentType
                  ? [{url: 'contentType', valueString: att.contentType}]
                  : []),
              ],
            }))
        : [];

    const extensions = [
      companion?.category
        ? {
            id: 'species',
            url: 'https://hl7.org/fhir/animal-species',
            valueString: companion.category.charAt(0).toUpperCase() + companion.category.slice(1),
          }
        : null,
      companion?.breed?.breedName
        ? {
            id: 'breed',
            url: 'https://hl7.org/fhir/animal-breed',
            valueString: companion.breed.breedName,
          }
        : null,
      {
        url: 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-is-emergency',
        valueBoolean: payload.emergency ?? false,
      },
      ...attachmentExtensions,
    ].filter(Boolean);

    const bookPayload = {
      resourceType: 'Appointment',
      serviceType: [
        {
          coding: [
            {
              system: 'https://example.org/appointment-types',
              code: payload.serviceId,
              display: payload.serviceName,
            },
          ],
          text: payload.serviceName,
        },
      ],
      speciality: payload.specialityId || payload.specialityName
        ? [
            {
              coding: [
                {
                  system: 'https://yosemitecrew.com/fhir/specialty',
                  code: payload.specialityId ?? payload.specialityName,
                  display: payload.specialityName ?? payload.specialityId ?? undefined,
                },
              ],
            },
          ]
        : [],
      participant: [
        {
          actor: {
            reference: `Patient/${payload.companionId}`,
            display: companion?.name,
          },
        },
        ...(user?.id
          ? [
              {
                actor: {
                  reference: `RelatedPerson/${user.id}`,
                  display:
                    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
                    user.email,
                },
              },
            ]
          : []),
        {
          actor: {
            reference: `Organization/${payload.businessId}`,
          },
        },
      ],
      start: startISO,
      end: endISO,
      minutesDuration,
      description: payload.concern ?? '',
      extension: extensions,
    };

    const {appointment, invoice, paymentIntent} = await appointmentApi.bookAppointment({
      payload: bookPayload,
      accessToken,
    });
    return {
      appointment,
      invoice,
      paymentIntent: paymentIntent ?? invoice?.paymentIntent ?? null,
    };
  } catch (error) {
    return rejectWithValue(toErrorMessage(error, 'Unable to create appointment'));
  }
});

export const updateAppointmentStatus = createAsyncThunk(
  'appointments/updateStatus',
  async (
    {
      appointmentId,
      status,
      employeeId,
    }: {appointmentId: string; status: AppointmentStatus; employeeId?: string | null},
    {rejectWithValue},
  ) => {
    try {
      const accessToken = await ensureAccessToken();
      const updated = await appointmentApi.getAppointment({appointmentId, accessToken});
      return {appointment: {...updated, status}, employeeId: employeeId ?? null};
    } catch (error) {
      return rejectWithValue(toErrorMessage(error, 'Unable to update appointment'));
    }
  },
);

export const rescheduleAppointment = createAsyncThunk(
  'appointments/reschedule',
  async (
    {
      appointmentId,
      startTime,
      endTime,
      isEmergency,
      concern,
    }: {appointmentId: string; startTime: string; endTime: string; isEmergency: boolean; concern: string},
    {rejectWithValue},
  ) => {
    try {
      const accessToken = await ensureAccessToken();
      const updated = await appointmentApi.rescheduleAppointment({
        appointmentId,
        startTime,
        endTime,
        isEmergency,
        concern,
        accessToken,
      });
      return updated;
    } catch (error) {
      return rejectWithValue(toErrorMessage(error, 'Unable to reschedule appointment'));
    }
  },
);

export const cancelAppointment = createAsyncThunk(
  'appointments/cancel',
  async ({appointmentId}: {appointmentId: string}, {rejectWithValue}) => {
    try {
      const accessToken = await ensureAccessToken();
      const updated = await appointmentApi.cancelAppointment({appointmentId, accessToken});
      return updated;
    } catch (error) {
      return rejectWithValue(toErrorMessage(error, 'Unable to cancel appointment'));
    }
  },
);

export const recordPayment = createAsyncThunk(
  'appointments/recordPayment',
  async ({appointmentId}: {appointmentId: string}, {rejectWithValue}) => {
    try {
      const accessToken = await ensureAccessToken();
      const refreshed = await appointmentApi.getAppointment({appointmentId, accessToken});
      return {appointment: refreshed};
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

const upsertAppointment = (state: AppointmentsState, appointment: Appointment) => {
  const idx = state.items.findIndex(a => a.id === appointment.id);
  if (idx >= 0) {
    state.items[idx] = {...state.items[idx], ...appointment};
  } else {
    state.items.push(appointment);
  }
};

const appointmentsSlice = createSlice({
  name: 'appointments',
  initialState,
  reducers: {
    upsertInvoice: (state, action: PayloadAction<Invoice>) => {
      const idx = state.invoices.findIndex(inv => inv.id === action.payload.id);
      if (idx >= 0) {
        state.invoices[idx] = action.payload;
      } else {
        state.invoices.push(action.payload);
      }
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
        const {companionId, items} = action.payload as {companionId: string; items: Appointment[]};
        state.items = state.items.filter(a => a.companionId !== companionId);
        state.items.push(...items);
        state.hydratedCompanions[companionId] = true;
      })
      .addCase(fetchAppointmentsForCompanion.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? 'Unable to fetch appointments';
      })
      .addCase(fetchAppointmentById.fulfilled, (state, action) => {
        upsertAppointment(state, action.payload);
      })
      .addCase(createAppointment.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createAppointment.fulfilled, (state, action) => {
        state.loading = false;
        const {appointment, invoice, paymentIntent} = action.payload;
        upsertAppointment(state, appointment);
        const normalizedInvoice =
          invoice ??
          (paymentIntent
            ? {
                id: paymentIntent.paymentIntentId ?? `pending-${appointment.id}`,
                appointmentId: appointment.id,
                items: [],
                subtotal: paymentIntent.amount ?? 0,
                total: paymentIntent.amount ?? 0,
                currency: paymentIntent.currency ?? 'USD',
                invoiceNumber: paymentIntent.paymentIntentId ?? undefined,
                paymentIntent,
                status: 'AWAITING_PAYMENT',
              }
            : null);

        if (normalizedInvoice) {
          const withIntent: Invoice = {
            ...normalizedInvoice,
            invoiceNumber:
              normalizedInvoice.invoiceNumber ??
              normalizedInvoice.id ??
              paymentIntent?.paymentIntentId,
            paymentIntent: paymentIntent ?? normalizedInvoice.paymentIntent ?? null,
          };
          const idx = state.invoices.findIndex(
            inv =>
              inv.id === withIntent.id ||
              (paymentIntent?.paymentIntentId && inv.id === paymentIntent.paymentIntentId),
          );
          if (idx >= 0) {
            state.invoices[idx] = withIntent;
          } else {
            state.invoices.push(withIntent);
          }
        }
        state.hydratedCompanions[appointment.companionId] = true;
      })
      .addCase(createAppointment.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? 'Unable to create appointment';
      })
      .addCase(updateAppointmentStatus.fulfilled, (state, action) => {
        const {appointment, employeeId} = action.payload as any;
        if (appointment) {
          const updated = {...appointment, employeeId: employeeId ?? appointment.employeeId};
          upsertAppointment(state, updated);
        }
      })
      .addCase(rescheduleAppointment.fulfilled, (state, action) => {
        upsertAppointment(state, action.payload);
      })
      .addCase(cancelAppointment.fulfilled, (state, action) => {
        const canceled = action.payload;
        const normalized: Appointment = {
          ...canceled,
          status: canceled.status ?? 'CANCELLED',
        };
        upsertAppointment(state, normalized);
      })
      .addCase(recordPayment.fulfilled, (state, action) => {
        const refreshed = (action.payload as any)?.appointment as Appointment | undefined;
        if (refreshed) {
          const inferredStatus: AppointmentStatus =
            refreshed.status &&
            refreshed.status !== 'NO_PAYMENT' &&
            refreshed.status !== 'AWAITING_PAYMENT'
              ? refreshed.status
              : 'PAID';
          upsertAppointment(state, {...refreshed, status: inferredStatus});
        }
      });
  },
});

export const {upsertInvoice} = appointmentsSlice.actions;
export default appointmentsSlice.reducer;
