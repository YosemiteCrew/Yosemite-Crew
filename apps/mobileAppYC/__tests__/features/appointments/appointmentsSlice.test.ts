import {configureStore} from '@reduxjs/toolkit';
import appointmentsReducer, {
  fetchAppointmentsForCompanion,
  fetchAppointmentById,
  createAppointment,
  updateAppointmentStatus,
  checkInAppointment,
  rescheduleAppointment,
  cancelAppointment,
  fetchPaymentIntentForAppointment,
  recordPayment,
  fetchInvoiceForAppointment,
  upsertInvoice,
  resetAppointmentsState,
} from '../../../src/features/appointments/appointmentsSlice';
import {appointmentApi} from '../../../src/features/appointments/services/appointmentsService';
import {
  getFreshStoredTokens,
  isTokenExpired,
} from '../../../src/features/auth/sessionManager';
import {toFHIRAppointment} from '@yosemite-crew/types';

jest.mock(
  '../../../src/features/appointments/services/appointmentsService',
  () => ({
    appointmentApi: {
      listAppointments: jest.fn(),
      getAppointment: jest.fn(),
      bookAppointment: jest.fn(),
      checkInAppointment: jest.fn(),
      rescheduleAppointment: jest.fn(),
      cancelAppointment: jest.fn(),
      createPaymentIntent: jest.fn(),
      fetchInvoiceForAppointment: jest.fn(),
    },
  }),
);

jest.mock('../../../src/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(),
  isTokenExpired: jest.fn(),
}));

jest.mock('@yosemite-crew/types', () => ({
  toFHIRAppointment: jest.fn((appointment: any) => ({
    resourceType: 'Appointment',
    start: appointment.startTime?.toISOString?.(),
    end: appointment.endTime?.toISOString?.(),
    status: appointment.status,
    participant: [
      appointment.companion?.parent?.id
        ? {
            actor: {
              reference: `RelatedPerson/${appointment.companion.parent.id}`,
              display: appointment.companion.parent.name,
            },
          }
        : null,
      appointment.lead?.id
        ? {
            actor: {
              reference: `Practitioner/${appointment.lead.id}`,
              display: appointment.lead.name,
            },
          }
        : null,
    ].filter(Boolean),
    __source: appointment,
  })),
}));

const mockAppointment = {
  id: 'appt-1',
  companionId: 'comp-1',
  status: 'BOOKED',
  start: '2023-10-25T10:00:00Z',
  end: '2023-10-25T10:15:00Z',
  employeeId: 'emp-1',
};

const mockInvoice = {
  id: 'inv-1',
  appointmentId: 'appt-1',
  status: 'PAID',
  total: 100,
  subtotal: 100,
  currency: 'USD',
  items: [],
  paymentIntent: {
    paymentIntentId: 'pi_123',
    amount: 100,
    currency: 'USD',
  },
};

const initialState = {
  items: [],
  invoices: [],
  loading: false,
  error: null,
  hydratedCompanions: {},
};

const createTestStore = (
  appointmentsPreloadedState: any = {},
  overrides: {
    companions?: any[];
    employees?: any[];
    user?: any;
  } = {},
) =>
  configureStore({
    reducer: {
      appointments: appointmentsReducer,
      companion: (
        state: any = {
          companions: overrides.companions ?? [
            {
              id: 'comp-1',
              name: 'Buddy',
              category: 'dog',
              breed: {breedName: 'Pug'},
            },
          ],
        },
      ) => state,
      businesses: (
        state: any = {
          employees: overrides.employees ?? [
            {
              id: 'emp-1',
              name: 'Dr. Smith',
            },
          ],
        },
      ) => state,
      auth: (
        state: any = {
          user: overrides.user ?? {
            id: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
          },
        },
      ) => state,
    } as any,
    preloadedState: {
      appointments: {...initialState, ...appointmentsPreloadedState},
    } as any,
  });

describe('appointmentsSlice', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (getFreshStoredTokens as jest.Mock).mockResolvedValue({
      accessToken: 'valid-token',
      expiresAt: Date.now() + 10000,
    });

    (isTokenExpired as jest.Mock).mockReturnValue(false);

    (appointmentApi.bookAppointment as jest.Mock).mockResolvedValue({
      appointment: mockAppointment,
      invoice: null,
      paymentIntent: null,
    });
  });

  describe('reducers', () => {
    it('resetAppointmentsState resets state', () => {
      const dirtyState = {
        ...initialState,
        loading: true,
        error: 'bad',
        items: [mockAppointment],
        invoices: [mockInvoice],
        hydratedCompanions: {'comp-1': true},
      };

      const nextState = appointmentsReducer(
        dirtyState as any,
        resetAppointmentsState(),
      );

      expect(nextState).toEqual(initialState);
    });

    it('upsertInvoice inserts invoice', () => {
      const nextState = appointmentsReducer(
        initialState as any,
        upsertInvoice(mockInvoice as any),
      );

      expect(nextState.invoices).toEqual([mockInvoice]);
    });

    it('upsertInvoice updates existing invoice', () => {
      const nextState = appointmentsReducer(
        {...initialState, invoices: [mockInvoice]} as any,
        upsertInvoice({...mockInvoice, status: 'VOID'} as any),
      );

      expect(nextState.invoices).toHaveLength(1);
      expect(nextState.invoices[0].status).toBe('VOID');
    });
  });

  describe('auth failures through thunk path', () => {
    it('rejects when access token is missing', async () => {
      (getFreshStoredTokens as jest.Mock).mockResolvedValue(null);

      const store = createTestStore();
      await store.dispatch(
        fetchAppointmentsForCompanion({companionId: 'comp-1'}),
      );

      expect((store.getState() as any).appointments.error).toBe(
        'Missing access token. Please sign in again.',
      );
    });

    it('rejects when token is expired', async () => {
      (getFreshStoredTokens as jest.Mock).mockResolvedValue({
        accessToken: 'expired-token',
        expiresAt: 1,
      });
      (isTokenExpired as jest.Mock).mockReturnValue(true);

      const store = createTestStore();
      await store.dispatch(
        fetchAppointmentsForCompanion({companionId: 'comp-1'}),
      );

      expect((store.getState() as any).appointments.error).toBe(
        'Your session expired. Please sign in again.',
      );
    });
  });

  describe('fetchAppointmentsForCompanion', () => {
    it('sets loading on pending and replaces hydrated companion appointments on fulfilled', async () => {
      const oldSameCompanion = {
        ...mockAppointment,
        id: 'old-appt',
        companionId: 'comp-1',
      };
      const otherCompanion = {
        ...mockAppointment,
        id: 'other-appt',
        companionId: 'comp-2',
      };

      (appointmentApi.listAppointments as jest.Mock).mockResolvedValue([
        mockAppointment,
      ]);

      const store = createTestStore({
        items: [oldSameCompanion, otherCompanion],
      });

      const promise = store.dispatch(
        fetchAppointmentsForCompanion({companionId: 'comp-1'}),
      );

      expect((store.getState() as any).appointments.loading).toBe(true);
      expect((store.getState() as any).appointments.error).toBeNull();

      await promise;

      const state = (store.getState() as any).appointments;
      expect(state.loading).toBe(false);
      expect(state.items).toHaveLength(2);
      expect(state.items.find((a: any) => a.id === 'old-appt')).toBeUndefined();
      expect(state.items.find((a: any) => a.id === 'other-appt')).toBeDefined();
      expect(state.items.find((a: any) => a.id === 'appt-1')).toBeDefined();
      expect(state.hydratedCompanions['comp-1']).toBe(true);
      expect(appointmentApi.listAppointments).toHaveBeenCalledWith({
        companionId: 'comp-1',
        accessToken: 'valid-token',
      });
    });

    it('stores Error message on rejected', async () => {
      (appointmentApi.listAppointments as jest.Mock).mockRejectedValue(
        new Error('Network Error'),
      );

      const store = createTestStore();
      await store.dispatch(
        fetchAppointmentsForCompanion({companionId: 'comp-1'}),
      );

      expect((store.getState() as any).appointments.loading).toBe(false);
      expect((store.getState() as any).appointments.error).toBe(
        'Network Error',
      );
    });

    it('uses fallback message for non-Error rejection', async () => {
      (appointmentApi.listAppointments as jest.Mock).mockRejectedValue('bad');

      const store = createTestStore();
      await store.dispatch(
        fetchAppointmentsForCompanion({companionId: 'comp-1'}),
      );

      expect((store.getState() as any).appointments.error).toBe(
        'Unable to fetch appointments',
      );
    });
  });

  describe('fetchAppointmentById', () => {
    it('inserts appointment on fulfilled', async () => {
      (appointmentApi.getAppointment as jest.Mock).mockResolvedValue(
        mockAppointment,
      );

      const store = createTestStore();
      await store.dispatch(fetchAppointmentById({appointmentId: 'appt-1'}));

      expect((store.getState() as any).appointments.items).toEqual([
        mockAppointment,
      ]);
    });

    it('updates existing appointment on fulfilled', async () => {
      (appointmentApi.getAppointment as jest.Mock).mockResolvedValue({
        ...mockAppointment,
        status: 'CONFIRMED',
      });

      const store = createTestStore({
        items: [{...mockAppointment, status: 'REQUESTED'}],
      });

      await store.dispatch(fetchAppointmentById({appointmentId: 'appt-1'}));

      expect((store.getState() as any).appointments.items).toHaveLength(1);
      expect((store.getState() as any).appointments.items[0].status).toBe(
        'CONFIRMED',
      );
    });

    it('rejects with error message', async () => {
      (appointmentApi.getAppointment as jest.Mock).mockRejectedValue(
        new Error('Load failed'),
      );

      const store = createTestStore();
      const result = await store.dispatch(
        fetchAppointmentById({appointmentId: 'appt-1'}),
      );

      expect(result.type).toBe('appointments/fetchById/rejected');
      expect(result.payload).toBe('Load failed');
    });

    it('rejects with fallback message for non-Error', async () => {
      (appointmentApi.getAppointment as jest.Mock).mockRejectedValue('bad');

      const store = createTestStore();
      const result = await store.dispatch(
        fetchAppointmentById({appointmentId: 'appt-1'}),
      );

      expect(result.payload).toBe('Unable to load appointment');
    });
  });

  describe('createAppointment', () => {
    const basePayload = {
      businessId: 'biz-1',
      serviceId: 'srv-1',
      serviceName: 'Exam',
      specialityId: 'spec-1',
      specialityName: 'General Care',
      date: '2023-12-01',
      startTime: '10:00',
      endTime: '10:15',
      employeeId: 'emp-1',
      employeeName: 'Dr. Override',
      concern: 'Coughing',
      emergency: true,
      companionId: 'comp-1',
      attachments: [
        {
          key: 'file-key',
          name: 'photo.png',
          contentType: 'image/png',
        },
        {
          key: '',
          name: 'empty-key-skipped',
        },
        {
          key: 'file-key-2',
        },
      ],
    };

    it('sets loading on pending and creates appointment with invoice', async () => {
      (appointmentApi.bookAppointment as jest.Mock).mockResolvedValue({
        appointment: mockAppointment,
        invoice: mockInvoice,
        paymentIntent: null,
      });

      const store = createTestStore();

      const promise = store.dispatch(createAppointment(basePayload as any));
      expect((store.getState() as any).appointments.loading).toBe(true);
      expect((store.getState() as any).appointments.error).toBeNull();

      await promise;

      const state = (store.getState() as any).appointments;
      expect(state.loading).toBe(false);
      expect(state.items[0]).toEqual(mockAppointment);
      expect(state.invoices[0]).toEqual({
        ...mockInvoice,
        invoiceNumber: mockInvoice.id,
        paymentIntent: mockInvoice.paymentIntent,
      });
      expect(state.hydratedCompanions['comp-1']).toBe(true);
    });

    it('builds shared appointment data before converting to FHIR', async () => {
      const store = createTestStore();

      await store.dispatch(createAppointment(basePayload as any));

      const shared = (toFHIRAppointment as jest.Mock).mock.calls[0][0];

      expect(shared).toEqual(
        expect.objectContaining({
          organisationId: 'biz-1',
          status: 'REQUESTED',
          isEmergency: true,
          concern: 'Coughing',
          timeSlot: '10:00',
          durationMinutes: 15,
        }),
      );

      expect(shared.companion).toEqual(
        expect.objectContaining({
          id: 'comp-1',
          name: 'Buddy',
          species: 'Dog',
          breed: 'Pug',
          parent: {
            id: 'user-1',
            name: 'John Doe',
          },
        }),
      );

      expect(shared.patient).toEqual(shared.companion);

      expect(shared.lead).toEqual({
        id: 'emp-1',
        name: 'Dr. Override',
      });

      expect(shared.appointmentType).toEqual({
        id: 'srv-1',
        name: 'Exam',
        speciality: {
          id: 'spec-1',
          name: 'General Care',
        },
      });

      expect(shared.attachments).toEqual([
        {
          key: 'file-key',
          name: 'photo.png',
          contentType: 'image/png',
        },
        {
          key: 'file-key-2',
          name: 'file-key-2',
          contentType: undefined,
        },
      ]);
    });

    it('uses employee from state when employeeName is omitted', async () => {
      const store = createTestStore();

      await store.dispatch(
        createAppointment({
          ...basePayload,
          employeeName: undefined,
        } as any),
      );

      const shared = (toFHIRAppointment as jest.Mock).mock.calls[0][0];
      expect(shared.lead).toEqual({
        id: 'emp-1',
        name: 'Dr. Smith',
      });
    });

    it('omits lead when employee id is blank', async () => {
      const store = createTestStore();

      await store.dispatch(
        createAppointment({
          ...basePayload,
          employeeId: '   ',
          employeeName: '   ',
        } as any),
      );

      const shared = (toFHIRAppointment as jest.Mock).mock.calls[0][0];
      expect(shared.lead).toBeUndefined();
    });

    it('uses utc start/end overrides and writes them onto FHIR payload', async () => {
      const store = createTestStore();

      await store.dispatch(
        createAppointment({
          ...basePayload,
          startTimeUtc: '2023-12-01T12:00:00.000Z',
          endTimeUtc: '2023-12-01T12:45:00.000Z',
        } as any),
      );

      const shared = (toFHIRAppointment as jest.Mock).mock.calls[0][0];
      const apiArg = (appointmentApi.bookAppointment as jest.Mock).mock
        .calls[0][0];

      expect(shared.durationMinutes).toBe(45);
      expect(apiArg.payload.start).toBe('2023-12-01T12:00:00.000Z');
      expect(apiArg.payload.end).toBe('2023-12-01T12:45:00.000Z');
      expect(apiArg.accessToken).toBe('valid-token');
    });

    it('defaults end time to 15 minutes after start when endTime is missing', async () => {
      const store = createTestStore();

      await store.dispatch(
        createAppointment({
          ...basePayload,
          endTime: '',
          endTimeUtc: null,
        } as any),
      );

      const shared = (toFHIRAppointment as jest.Mock).mock.calls[0][0];
      expect(shared.durationMinutes).toBe(15);
    });

    it('minimum duration is 1 minute when end is before start', async () => {
      const store = createTestStore();

      await store.dispatch(
        createAppointment({
          ...basePayload,
          startTimeUtc: '2023-12-01T12:00:00.000Z',
          endTimeUtc: '2023-12-01T11:00:00.000Z',
        } as any),
      );

      const shared = (toFHIRAppointment as jest.Mock).mock.calls[0][0];
      expect(shared.durationMinutes).toBe(1);
    });

    it('uses email as parent name when first and last name are absent', async () => {
      const store = createTestStore(
        {},
        {
          user: {
            id: 'user-email',
            email: 'person@example.com',
          },
        },
      );

      await store.dispatch(createAppointment(basePayload as any));

      const shared = (toFHIRAppointment as jest.Mock).mock.calls[0][0];
      expect(shared.companion.parent).toEqual({
        id: 'user-email',
        name: 'person@example.com',
      });
    });

    it('uses parentId over user id when present', async () => {
      const store = createTestStore(
        {},
        {
          user: {
            id: 'user-1',
            parentId: 'parent-1',
            email: 'parent@example.com',
          },
        },
      );

      await store.dispatch(createAppointment(basePayload as any));

      const shared = (toFHIRAppointment as jest.Mock).mock.calls[0][0];
      expect(shared.companion.parent.id).toBe('parent-1');
    });

    it('removes RelatedPerson participant when no parent reference id exists', async () => {
      const store = createTestStore(
        {},
        {
          user: {
            email: 'noparent@example.com',
          },
        },
      );

      await store.dispatch(createAppointment(basePayload as any));

      const apiArg = (appointmentApi.bookAppointment as jest.Mock).mock
        .calls[0][0];
      expect(
        apiArg.payload.participant.some((participant: any) =>
          participant.actor.reference.startsWith('RelatedPerson/'),
        ),
      ).toBe(false);
    });

    it('creates normalized invoice from paymentIntent when invoice is null', async () => {
      const paymentIntent = {
        paymentIntentId: 'pi_new',
        amount: 50,
        currency: 'USD',
      };

      (appointmentApi.bookAppointment as jest.Mock).mockResolvedValue({
        appointment: mockAppointment,
        invoice: null,
        paymentIntent,
      });

      const store = createTestStore();
      await store.dispatch(createAppointment(basePayload as any));

      expect((store.getState() as any).appointments.invoices[0]).toEqual(
        expect.objectContaining({
          id: 'pi_new',
          appointmentId: 'appt-1',
          subtotal: 50,
          total: 50,
          currency: 'USD',
          invoiceNumber: 'pi_new',
          paymentIntent,
          status: 'AWAITING_PAYMENT',
        }),
      );
    });

    it('creates pending invoice id when paymentIntent has no id', async () => {
      const paymentIntent = {
        amount: 25,
      };

      (appointmentApi.bookAppointment as jest.Mock).mockResolvedValue({
        appointment: mockAppointment,
        invoice: null,
        paymentIntent,
      });

      const store = createTestStore();
      await store.dispatch(createAppointment(basePayload as any));

      expect((store.getState() as any).appointments.invoices[0]).toEqual(
        expect.objectContaining({
          id: 'pending-appt-1',
          invoiceNumber: 'pending-appt-1',
          currency: 'USD',
          total: 25,
        }),
      );
    });

    it('uses invoice paymentIntent when top-level paymentIntent is absent', async () => {
      (appointmentApi.bookAppointment as jest.Mock).mockResolvedValue({
        appointment: mockAppointment,
        invoice: mockInvoice,
        paymentIntent: null,
      });

      const store = createTestStore();
      const result = await store.dispatch(
        createAppointment(basePayload as any),
      );

      expect((result.payload as any).paymentIntent).toEqual(
        mockInvoice.paymentIntent,
      );
    });

    it('updates existing invoice by id', async () => {
      (appointmentApi.bookAppointment as jest.Mock).mockResolvedValue({
        appointment: mockAppointment,
        invoice: {...mockInvoice, total: 200},
        paymentIntent: null,
      });

      const store = createTestStore({
        invoices: [mockInvoice],
      });

      await store.dispatch(createAppointment(basePayload as any));

      expect((store.getState() as any).appointments.invoices).toHaveLength(1);
      expect((store.getState() as any).appointments.invoices[0].total).toBe(
        200,
      );
    });

    it('updates existing invoice by paymentIntent id', async () => {
      const paymentIntent = {
        paymentIntentId: 'pi_existing',
        amount: 75,
        currency: 'USD',
      };

      (appointmentApi.bookAppointment as jest.Mock).mockResolvedValue({
        appointment: mockAppointment,
        invoice: null,
        paymentIntent,
      });

      const store = createTestStore({
        invoices: [
          {
            id: 'pi_existing',
            appointmentId: 'old',
            total: 1,
          },
        ],
      });

      await store.dispatch(createAppointment(basePayload as any));

      expect((store.getState() as any).appointments.invoices).toHaveLength(1);
      expect((store.getState() as any).appointments.invoices[0].total).toBe(75);
    });

    it('rejects with API error and clears loading', async () => {
      (appointmentApi.bookAppointment as jest.Mock).mockRejectedValue(
        new Error('Booking Failed'),
      );

      const store = createTestStore();
      const result = await store.dispatch(
        createAppointment(basePayload as any),
      );

      expect(result.type).toBe('appointments/create/rejected');
      expect(result.payload).toBe('Booking Failed');
      expect((store.getState() as any).appointments.loading).toBe(false);
      expect((store.getState() as any).appointments.error).toBe(
        'Booking Failed',
      );
    });

    it('rejects with fallback for non-Error create failure', async () => {
      (appointmentApi.bookAppointment as jest.Mock).mockRejectedValue('bad');

      const store = createTestStore();
      const result = await store.dispatch(
        createAppointment(basePayload as any),
      );

      expect(result.payload).toBe('Unable to create appointment');
    });
  });

  describe('updateAppointmentStatus', () => {
    it('fetches appointment and overrides status', async () => {
      (appointmentApi.getAppointment as jest.Mock).mockResolvedValue(
        mockAppointment,
      );

      const store = createTestStore();
      await store.dispatch(
        updateAppointmentStatus({
          appointmentId: 'appt-1',
          status: 'ARRIVED' as any,
        }),
      );

      expect((store.getState() as any).appointments.items[0].status).toBe(
        'ARRIVED',
      );
    });

    it('uses provided employee id over appointment employee id', async () => {
      (appointmentApi.getAppointment as jest.Mock).mockResolvedValue(
        mockAppointment,
      );

      const store = createTestStore();
      await store.dispatch(
        updateAppointmentStatus({
          appointmentId: 'appt-1',
          status: 'FULFILLED' as any,
          employeeId: 'emp-99',
        }),
      );

      expect((store.getState() as any).appointments.items[0].employeeId).toBe(
        'emp-99',
      );
    });

    it('keeps existing appointment employee id when employeeId is nullish', async () => {
      (appointmentApi.getAppointment as jest.Mock).mockResolvedValue(
        mockAppointment,
      );

      const store = createTestStore();
      await store.dispatch(
        updateAppointmentStatus({
          appointmentId: 'appt-1',
          status: 'FULFILLED' as any,
          employeeId: null,
        }),
      );

      expect((store.getState() as any).appointments.items[0].employeeId).toBe(
        'emp-1',
      );
    });

    it('rejects with error message', async () => {
      (appointmentApi.getAppointment as jest.Mock).mockRejectedValue(
        new Error('Update failed'),
      );

      const store = createTestStore();
      const result = await store.dispatch(
        updateAppointmentStatus({
          appointmentId: 'appt-1',
          status: 'ARRIVED' as any,
        }),
      );

      expect(result.payload).toBe('Update failed');
    });

    it('rejects with fallback for non-Error', async () => {
      (appointmentApi.getAppointment as jest.Mock).mockRejectedValue('bad');

      const store = createTestStore();
      const result = await store.dispatch(
        updateAppointmentStatus({
          appointmentId: 'appt-1',
          status: 'ARRIVED' as any,
        }),
      );

      expect(result.payload).toBe('Unable to update appointment');
    });
  });

  describe('checkInAppointment', () => {
    it('upserts appointment on fulfilled', async () => {
      (appointmentApi.checkInAppointment as jest.Mock).mockResolvedValue({
        ...mockAppointment,
        status: 'ARRIVED',
      });

      const store = createTestStore();
      await store.dispatch(checkInAppointment({appointmentId: 'appt-1'}));

      expect((store.getState() as any).appointments.items[0].status).toBe(
        'ARRIVED',
      );
    });

    it('does nothing if fulfilled payload is undefined', () => {
      const nextState = appointmentsReducer(
        initialState as any,
        {
          type: checkInAppointment.fulfilled.type,
          payload: undefined,
        } as any,
      );

      expect(nextState.items).toEqual([]);
    });

    it('rejects with error message', async () => {
      (appointmentApi.checkInAppointment as jest.Mock).mockRejectedValue(
        new Error('Check-in failed'),
      );

      const store = createTestStore();
      const result = await store.dispatch(
        checkInAppointment({appointmentId: 'a1'}),
      );

      expect(result.payload).toBe('Check-in failed');
    });

    it('rejects with fallback for non-Error', async () => {
      (appointmentApi.checkInAppointment as jest.Mock).mockRejectedValue('bad');

      const store = createTestStore();
      const result = await store.dispatch(
        checkInAppointment({appointmentId: 'a1'}),
      );

      expect(result.payload).toBe('Unable to check in');
    });
  });

  describe('rescheduleAppointment', () => {
    it('upserts appointment on fulfilled', async () => {
      (appointmentApi.rescheduleAppointment as jest.Mock).mockResolvedValue({
        ...mockAppointment,
        start: 'new-start',
      });

      const store = createTestStore();
      await store.dispatch(
        rescheduleAppointment({
          appointmentId: 'appt-1',
          startTime: 'new-start',
          endTime: 'new-end',
          isEmergency: false,
          concern: '',
        }),
      );

      expect((store.getState() as any).appointments.items[0].start).toBe(
        'new-start',
      );
      expect(appointmentApi.rescheduleAppointment).toHaveBeenCalledWith({
        appointmentId: 'appt-1',
        startTime: 'new-start',
        endTime: 'new-end',
        isEmergency: false,
        concern: '',
        accessToken: 'valid-token',
      });
    });

    it('rejects with error message', async () => {
      (appointmentApi.rescheduleAppointment as jest.Mock).mockRejectedValue(
        new Error('Reschedule failed'),
      );

      const store = createTestStore();
      const result = await store.dispatch(
        rescheduleAppointment({
          appointmentId: 'appt-1',
          startTime: '',
          endTime: '',
          isEmergency: false,
          concern: '',
        }),
      );

      expect(result.payload).toBe('Reschedule failed');
    });

    it('rejects with fallback for non-Error', async () => {
      (appointmentApi.rescheduleAppointment as jest.Mock).mockRejectedValue(
        'bad',
      );

      const store = createTestStore();
      const result = await store.dispatch(
        rescheduleAppointment({
          appointmentId: 'appt-1',
          startTime: '',
          endTime: '',
          isEmergency: false,
          concern: '',
        }),
      );

      expect(result.payload).toBe('Unable to reschedule appointment');
    });
  });

  describe('cancelAppointment', () => {
    it('upserts canceled appointment and defaults missing status to CANCELLED', async () => {
      (appointmentApi.cancelAppointment as jest.Mock).mockResolvedValue({
        id: 'appt-1',
        companionId: 'comp-1',
      });

      const store = createTestStore();
      await store.dispatch(cancelAppointment({appointmentId: 'appt-1'}));

      expect((store.getState() as any).appointments.items[0].status).toBe(
        'CANCELLED',
      );
    });

    it('preserves returned cancel status when present', async () => {
      (appointmentApi.cancelAppointment as jest.Mock).mockResolvedValue({
        id: 'appt-1',
        companionId: 'comp-1',
        status: 'NO_SHOW',
      });

      const store = createTestStore();
      await store.dispatch(cancelAppointment({appointmentId: 'appt-1'}));

      expect((store.getState() as any).appointments.items[0].status).toBe(
        'NO_SHOW',
      );
    });

    it('rejects with error message', async () => {
      (appointmentApi.cancelAppointment as jest.Mock).mockRejectedValue(
        new Error('Cancel failed'),
      );

      const store = createTestStore();
      const result = await store.dispatch(
        cancelAppointment({appointmentId: 'a1'}),
      );

      expect(result.payload).toBe('Cancel failed');
    });

    it('rejects with fallback for non-Error', async () => {
      (appointmentApi.cancelAppointment as jest.Mock).mockRejectedValue('bad');

      const store = createTestStore();
      const result = await store.dispatch(
        cancelAppointment({appointmentId: 'a1'}),
      );

      expect(result.payload).toBe('Unable to cancel appointment');
    });
  });

  describe('fetchPaymentIntentForAppointment', () => {
    it('updates appointment and invoice when both exist', async () => {
      const intent = {
        paymentIntentId: 'pi_new',
        amount: 50,
        currency: 'USD',
      };

      (appointmentApi.createPaymentIntent as jest.Mock).mockResolvedValue(
        intent,
      );

      const store = createTestStore({
        items: [mockAppointment],
        invoices: [
          {
            id: 'inv-1',
            appointmentId: 'appt-1',
          },
        ],
      });

      await store.dispatch(
        fetchPaymentIntentForAppointment({appointmentId: 'appt-1'}),
      );

      const state = (store.getState() as any).appointments;
      expect(state.items[0].paymentIntent).toEqual(intent);
      expect(state.invoices[0].paymentIntent).toEqual(intent);
      expect(state.invoices[0].invoiceNumber).toBe('pi_new');
    });

    it('preserves existing invoiceNumber when present', async () => {
      const intent = {
        paymentIntentId: 'pi_new',
      };

      (appointmentApi.createPaymentIntent as jest.Mock).mockResolvedValue(
        intent,
      );

      const store = createTestStore({
        invoices: [
          {
            id: 'inv-1',
            appointmentId: 'appt-1',
            invoiceNumber: 'INV-001',
          },
        ],
      });

      await store.dispatch(
        fetchPaymentIntentForAppointment({appointmentId: 'appt-1'}),
      );

      expect(
        (store.getState() as any).appointments.invoices[0].invoiceNumber,
      ).toBe('INV-001');
    });

    it('does not crash when appointment and invoice are missing', async () => {
      const intent = {
        paymentIntentId: 'pi_new',
      };

      (appointmentApi.createPaymentIntent as jest.Mock).mockResolvedValue(
        intent,
      );

      const store = createTestStore();
      await store.dispatch(
        fetchPaymentIntentForAppointment({appointmentId: 'missing'}),
      );

      const state = (store.getState() as any).appointments;
      expect(state.items).toEqual([]);
      expect(state.invoices).toEqual([]);
    });

    it('rejects with error message', async () => {
      (appointmentApi.createPaymentIntent as jest.Mock).mockRejectedValue(
        new Error('Intent failed'),
      );

      const store = createTestStore();
      const result = await store.dispatch(
        fetchPaymentIntentForAppointment({appointmentId: 'a1'}),
      );

      expect(result.payload).toBe('Intent failed');
    });

    it('rejects with fallback for non-Error', async () => {
      (appointmentApi.createPaymentIntent as jest.Mock).mockRejectedValue(
        'bad',
      );

      const store = createTestStore();
      const result = await store.dispatch(
        fetchPaymentIntentForAppointment({appointmentId: 'a1'}),
      );

      expect(result.payload).toBe('Unable to fetch payment intent');
    });
  });

  describe('recordPayment', () => {
    it('keeps refreshed status when already valid', async () => {
      (appointmentApi.getAppointment as jest.Mock).mockResolvedValue({
        id: 'appt-1',
        status: 'ARRIVED',
      });

      const store = createTestStore();
      await store.dispatch(recordPayment({appointmentId: 'appt-1'}));

      expect((store.getState() as any).appointments.items[0].status).toBe(
        'ARRIVED',
      );
    });

    it('infers PAID when refreshed status is NO_PAYMENT', async () => {
      (appointmentApi.getAppointment as jest.Mock).mockResolvedValue({
        id: 'appt-1',
        status: 'NO_PAYMENT',
      });

      const store = createTestStore();
      await store.dispatch(recordPayment({appointmentId: 'appt-1'}));

      expect((store.getState() as any).appointments.items[0].status).toBe(
        'PAID',
      );
    });

    it('infers PAID when refreshed status is AWAITING_PAYMENT', async () => {
      (appointmentApi.getAppointment as jest.Mock).mockResolvedValue({
        id: 'appt-1',
        status: 'AWAITING_PAYMENT',
      });

      const store = createTestStore();
      await store.dispatch(recordPayment({appointmentId: 'appt-1'}));

      expect((store.getState() as any).appointments.items[0].status).toBe(
        'PAID',
      );
    });

    it('infers PAID when refreshed status is missing', async () => {
      (appointmentApi.getAppointment as jest.Mock).mockResolvedValue({
        id: 'appt-1',
      });

      const store = createTestStore();
      await store.dispatch(recordPayment({appointmentId: 'appt-1'}));

      expect((store.getState() as any).appointments.items[0].status).toBe(
        'PAID',
      );
    });

    it('does nothing if fulfilled payload has no appointment', () => {
      const nextState = appointmentsReducer(
        initialState as any,
        {
          type: recordPayment.fulfilled.type,
          payload: {},
        } as any,
      );

      expect(nextState.items).toEqual([]);
    });

    it('rejects with error message', async () => {
      (appointmentApi.getAppointment as jest.Mock).mockRejectedValue(
        new Error('Payment refresh failed'),
      );

      const store = createTestStore();
      const result = await store.dispatch(recordPayment({appointmentId: 'a1'}));

      expect(result.payload).toBe('Payment refresh failed');
    });

    it('rejects with fallback for non-Error', async () => {
      (appointmentApi.getAppointment as jest.Mock).mockRejectedValue('bad');

      const store = createTestStore();
      const result = await store.dispatch(recordPayment({appointmentId: 'a1'}));

      expect(result.payload).toBe('Unable to record payment');
    });
  });

  describe('fetchInvoiceForAppointment', () => {
    it('updates existing invoice and appointment payment intent', async () => {
      const paymentIntent = {
        paymentIntentId: 'pi_invoice',
      };

      (
        appointmentApi.fetchInvoiceForAppointment as jest.Mock
      ).mockResolvedValue({
        invoice: {
          ...mockInvoice,
          status: 'OPEN',
        },
        paymentIntent,
      });

      const store = createTestStore({
        items: [mockAppointment],
        invoices: [
          {
            ...mockInvoice,
            status: 'OLD',
          },
        ],
      });

      await store.dispatch(
        fetchInvoiceForAppointment({appointmentId: 'appt-1'}),
      );

      const state = (store.getState() as any).appointments;
      expect(state.invoices).toHaveLength(1);
      expect(state.invoices[0].status).toBe('OPEN');
      expect(state.invoices[0].paymentIntent).toEqual(paymentIntent);
      expect(state.items[0].paymentIntent).toEqual(paymentIntent);
    });

    it('pushes new invoice when none exists', async () => {
      (
        appointmentApi.fetchInvoiceForAppointment as jest.Mock
      ).mockResolvedValue({
        invoice: mockInvoice,
        paymentIntent: null,
      });

      const store = createTestStore();
      await store.dispatch(
        fetchInvoiceForAppointment({appointmentId: 'appt-1'}),
      );

      expect((store.getState() as any).appointments.invoices).toEqual([
        {
          ...mockInvoice,
          paymentIntent: null,
        },
      ]);
    });

    it('updates appointment only when invoice is null and paymentIntent exists', async () => {
      const paymentIntent = {
        paymentIntentId: 'pi_only',
      };

      (
        appointmentApi.fetchInvoiceForAppointment as jest.Mock
      ).mockResolvedValue({
        invoice: null,
        paymentIntent,
      });

      const store = createTestStore({
        items: [mockAppointment],
      });

      await store.dispatch(
        fetchInvoiceForAppointment({appointmentId: 'appt-1'}),
      );

      const state = (store.getState() as any).appointments;
      expect(state.invoices).toEqual([]);
      expect(state.items[0].paymentIntent).toEqual(paymentIntent);
    });

    it('does nothing when invoice and paymentIntent are null', async () => {
      (
        appointmentApi.fetchInvoiceForAppointment as jest.Mock
      ).mockResolvedValue({
        invoice: null,
        paymentIntent: null,
      });

      const store = createTestStore({
        items: [mockAppointment],
      });

      await store.dispatch(
        fetchInvoiceForAppointment({appointmentId: 'appt-1'}),
      );

      expect(
        (store.getState() as any).appointments.items[0].paymentIntent,
      ).toBe(undefined);
      expect((store.getState() as any).appointments.invoices).toEqual([]);
    });

    it('does not crash when appointment is missing', async () => {
      (
        appointmentApi.fetchInvoiceForAppointment as jest.Mock
      ).mockResolvedValue({
        invoice: null,
        paymentIntent: {
          paymentIntentId: 'pi_missing_appt',
        },
      });

      const store = createTestStore();
      await store.dispatch(
        fetchInvoiceForAppointment({appointmentId: 'missing'}),
      );

      expect((store.getState() as any).appointments.items).toEqual([]);
    });

    it('rejects with error message', async () => {
      (
        appointmentApi.fetchInvoiceForAppointment as jest.Mock
      ).mockRejectedValue(new Error('Invoice failed'));

      const store = createTestStore();
      const result = await store.dispatch(
        fetchInvoiceForAppointment({appointmentId: 'appt-1'}),
      );

      expect(result.payload).toBe('Invoice failed');
    });

    it('rejects with fallback for non-Error', async () => {
      (
        appointmentApi.fetchInvoiceForAppointment as jest.Mock
      ).mockRejectedValue('bad');

      const store = createTestStore();
      const result = await store.dispatch(
        fetchInvoiceForAppointment({appointmentId: 'appt-1'}),
      );

      expect(result.payload).toBe('Unable to fetch invoice');
    });
  });

  describe('branch coverage edge cases', () => {
    it('covers tokens?.expiresAt ?? undefined fallback when expiresAt is null', async () => {
      (getFreshStoredTokens as jest.Mock).mockResolvedValue({
        accessToken: 'valid-token',
        expiresAt: null,
      });
      (isTokenExpired as jest.Mock).mockReturnValue(false);
      (appointmentApi.listAppointments as jest.Mock).mockResolvedValue([]);

      const store = createTestStore();
      await store.dispatch(
        fetchAppointmentsForCompanion({companionId: 'comp-1'}),
      );

      expect((store.getState() as any).appointments.error).toBeNull();
    });

    it('uses empty string parent name when user has no name fields or email', async () => {
      const store = createTestStore({}, {user: {id: 'bare-user'}});

      await store.dispatch(
        createAppointment({
          businessId: 'biz-1',
          serviceId: 'srv-1',
          serviceName: 'Exam',
          date: '2023-12-01',
          startTime: '10:00',
          endTime: '10:15',
          companionId: 'comp-1',
        } as any),
      );

      const shared = (toFHIRAppointment as jest.Mock).mock.calls[0][0];
      expect(shared.companion.parent.name).toBe('');
    });

    it('uses empty string species when companion has no category', async () => {
      const store = createTestStore(
        {},
        {
          companions: [
            {id: 'comp-1', name: 'Buddy', category: '', breed: null},
          ],
        },
      );

      await store.dispatch(
        createAppointment({
          businessId: 'biz-1',
          serviceId: 'srv-1',
          serviceName: 'Exam',
          date: '2023-12-01',
          startTime: '10:00',
          endTime: '10:15',
          companionId: 'comp-1',
        } as any),
      );

      const shared = (toFHIRAppointment as jest.Mock).mock.calls[0][0];
      expect(shared.companion.species).toBe('');
    });

    it('uses empty string companion name and species when companion is not found', async () => {
      const store = createTestStore({}, {companions: []});

      await store.dispatch(
        createAppointment({
          businessId: 'biz-1',
          serviceId: 'srv-1',
          serviceName: 'Exam',
          date: '2023-12-01',
          startTime: '10:00',
          endTime: '10:15',
          companionId: 'missing-comp',
        } as any),
      );

      const shared = (toFHIRAppointment as jest.Mock).mock.calls[0][0];
      expect(shared.companion.name).toBe('');
      expect(shared.companion.species).toBe('');
    });

    it('uses empty string lead name when employee found but has no name', async () => {
      const store = createTestStore(
        {},
        {
          employees: [{id: 'emp-no-name'}],
        },
      );

      await store.dispatch(
        createAppointment({
          businessId: 'biz-1',
          serviceId: 'srv-1',
          serviceName: 'Exam',
          date: '2023-12-01',
          startTime: '10:00',
          endTime: '10:15',
          companionId: 'comp-1',
          employeeId: 'emp-no-name',
        } as any),
      );

      const shared = (toFHIRAppointment as jest.Mock).mock.calls[0][0];
      expect(shared.lead.name).toBe('');
    });

    it('uses empty strings for speciality when specialityId and specialityName are omitted', async () => {
      const store = createTestStore();

      await store.dispatch(
        createAppointment({
          businessId: 'biz-1',
          serviceId: 'srv-1',
          serviceName: 'Exam',
          date: '2023-12-01',
          startTime: '10:00',
          endTime: '10:15',
          companionId: 'comp-1',
        } as any),
      );

      const shared = (toFHIRAppointment as jest.Mock).mock.calls[0][0];
      expect(shared.appointmentType.speciality.id).toBe('');
      expect(shared.appointmentType.speciality.name).toBe('');
    });

    it('defaults emergency to false and concern to empty when absent', async () => {
      const store = createTestStore();

      await store.dispatch(
        createAppointment({
          businessId: 'biz-1',
          serviceId: 'srv-1',
          serviceName: 'Exam',
          date: '2023-12-01',
          startTime: '10:00',
          endTime: '10:15',
          companionId: 'comp-1',
        } as any),
      );

      const shared = (toFHIRAppointment as jest.Mock).mock.calls[0][0];
      expect(shared.isEmergency).toBe(false);
      expect(shared.concern).toBe('');
    });

    it('filters participants when toFHIRAppointment returns no participant field and parentReferenceId is absent', async () => {
      (toFHIRAppointment as jest.Mock).mockReturnValueOnce({
        resourceType: 'Appointment',
        status: 'REQUESTED',
      });

      const store = createTestStore({}, {user: {email: 'no-id@example.com'}});

      await store.dispatch(
        createAppointment({
          businessId: 'biz-1',
          serviceId: 'srv-1',
          serviceName: 'Exam',
          date: '2023-12-01',
          startTime: '10:00',
          endTime: '10:15',
          companionId: 'comp-1',
        } as any),
      );

      const apiArg = (appointmentApi.bookAppointment as jest.Mock).mock
        .calls[0][0];
      expect(apiArg.payload.participant).toEqual([]);
    });

    it('uses 0 subtotal/total when paymentIntent has no amount', async () => {
      (appointmentApi.bookAppointment as jest.Mock).mockResolvedValue({
        appointment: mockAppointment,
        invoice: null,
        paymentIntent: {paymentIntentId: 'pi_no_amount'},
      });

      const store = createTestStore();
      await store.dispatch(
        createAppointment({
          businessId: 'biz-1',
          serviceId: 'srv-1',
          serviceName: 'Exam',
          date: '2023-12-01',
          startTime: '10:00',
          endTime: '10:15',
          companionId: 'comp-1',
        } as any),
      );

      const inv = (store.getState() as any).appointments.invoices[0];
      expect(inv.subtotal).toBe(0);
      expect(inv.total).toBe(0);
      expect(inv.currency).toBe('USD');
    });

    it('uses fallback error message in fetchAppointmentsForCompanion.rejected when payload is undefined', () => {
      const nextState = appointmentsReducer(
        initialState as any,
        {
          type: fetchAppointmentsForCompanion.rejected.type,
          payload: undefined,
        } as any,
      );
      expect(nextState.error).toBe('Unable to fetch appointments');
    });

    it('uses fallback error message in createAppointment.rejected when payload is undefined', () => {
      const nextState = appointmentsReducer(
        initialState as any,
        {type: createAppointment.rejected.type, payload: undefined} as any,
      );
      expect(nextState.error).toBe('Unable to create appointment');
    });

    it('does nothing in updateAppointmentStatus.fulfilled when appointment is absent', () => {
      const state = {...initialState, items: [mockAppointment]} as any;
      const nextState = appointmentsReducer(state, {
        type: updateAppointmentStatus.fulfilled.type,
        payload: {appointment: null, employeeId: null},
      } as any);
      expect(nextState.items).toHaveLength(1);
      expect(nextState.items[0]).toEqual(mockAppointment);
    });

    it('uses paymentIntent.paymentIntentId as invoiceNumber when invoiceNumber and id are both absent', async () => {
      (appointmentApi.bookAppointment as jest.Mock).mockResolvedValue({
        appointment: mockAppointment,
        invoice: {id: null, invoiceNumber: null, items: [], status: 'UNPAID'},
        paymentIntent: {
          paymentIntentId: 'pi_fallback',
          amount: 10,
          currency: 'USD',
        },
      });

      const store = createTestStore();
      await store.dispatch(
        createAppointment({
          businessId: 'biz-1',
          serviceId: 'srv-1',
          serviceName: 'Exam',
          date: '2023-12-01',
          startTime: '10:00',
          endTime: '10:15',
          companionId: 'comp-1',
        } as any),
      );

      const inv = (store.getState() as any).appointments.invoices[0];
      expect(inv.invoiceNumber).toBe('pi_fallback');
    });

    it('updates invoice by paymentIntentId when invoice id differs from payment intent id', async () => {
      (appointmentApi.bookAppointment as jest.Mock).mockResolvedValue({
        appointment: mockAppointment,
        invoice: {
          id: 'inv-new',
          invoiceNumber: null,
          items: [],
          status: 'UNPAID',
        },
        paymentIntent: {
          paymentIntentId: 'pi_match',
          amount: 99,
          currency: 'USD',
        },
      });

      const store = createTestStore({
        invoices: [{id: 'pi_match', appointmentId: 'old', total: 1}],
      });

      await store.dispatch(
        createAppointment({
          businessId: 'biz-1',
          serviceId: 'srv-1',
          serviceName: 'Exam',
          date: '2023-12-01',
          startTime: '10:00',
          endTime: '10:15',
          companionId: 'comp-1',
        } as any),
      );

      const invoices = (store.getState() as any).appointments.invoices;
      expect(invoices).toHaveLength(1);
      expect(invoices[0].id).toBe('inv-new');
    });

    it('sets null paymentIntent when both top-level and invoice paymentIntent are absent', async () => {
      (appointmentApi.bookAppointment as jest.Mock).mockResolvedValue({
        appointment: mockAppointment,
        invoice: {
          id: 'inv-no-pi',
          invoiceNumber: 'INV-X',
          items: [],
          status: 'UNPAID',
        },
        paymentIntent: null,
      });

      const store = createTestStore();
      await store.dispatch(
        createAppointment({
          businessId: 'biz-1',
          serviceId: 'srv-1',
          serviceName: 'Exam',
          date: '2023-12-01',
          startTime: '10:00',
          endTime: '10:15',
          companionId: 'comp-1',
        } as any),
      );

      const inv = (store.getState() as any).appointments.invoices[0];
      expect(inv.paymentIntent).toBeNull();
    });
  });
});
