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
import { appointmentApi } from '../../../src/features/appointments/services/appointmentsService';
import { getFreshStoredTokens, isTokenExpired } from '../../../src/features/auth/sessionManager';
import { configureStore } from '@reduxjs/toolkit';

// --- Mocks ---
jest.mock('../../../src/features/appointments/services/appointmentsService', () => ({
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
}));

jest.mock('../../../src/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(),
  isTokenExpired: jest.fn(),
}));

// --- Test Data ---
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
  currency: 'USD',
  paymentIntent: { paymentIntentId: 'pi_123', amount: 100, currency: 'USD' },
};

const initialState = {
  items: [],
  invoices: [],
  loading: false,
  error: null,
  hydratedCompanions: {},
};

// --- Helper to create a test store ---
const createTestStore = (preloadedState = {}) => {
  return configureStore({
    reducer: {
      appointments: appointmentsReducer,
      // FIX: Explicitly cast these reducers to any to avoid strict type mismatch with Redux types
      companion: (state: any = { companions: [{ id: 'comp-1', name: 'Buddy', category: 'dog', breed: { breedName: 'Pug' } }] }) => state,
      auth: (state: any = { user: { id: 'user-1', firstName: 'John' } }) => state,
    } as any,
    preloadedState: {
      appointments: { ...initialState, ...preloadedState },
    } as any,
  });
};

describe('appointmentsSlice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getFreshStoredTokens as jest.Mock).mockResolvedValue({ accessToken: 'valid-token', expiresAt: Date.now() + 10000 });
    (isTokenExpired as jest.Mock).mockReturnValue(false);
  });

  // --- Synchronous Reducers ---

  it('should handle resetAppointmentsState', () => {
    const dirtyState = { ...initialState, loading: true, items: [mockAppointment] };
    const nextState = appointmentsReducer(dirtyState as any, resetAppointmentsState());
    expect(nextState).toEqual(initialState);
  });

  it('should handle upsertInvoice (insert)', () => {
    const nextState = appointmentsReducer(initialState, upsertInvoice(mockInvoice as any));
    expect(nextState.invoices).toHaveLength(1);
    expect(nextState.invoices[0]).toEqual(mockInvoice);
  });

  it('should handle upsertInvoice (update)', () => {
    const stateWithInvoice = { ...initialState, invoices: [mockInvoice] };
    const updatedInvoice = { ...mockInvoice, status: 'VOID' };
    const nextState = appointmentsReducer(stateWithInvoice as any, upsertInvoice(updatedInvoice as any));
    expect(nextState.invoices).toHaveLength(1);
    expect(nextState.invoices[0].status).toBe('VOID');
  });

  // --- Async Thunks & Token Logic ---

  describe('ensureAccessToken logic via thunk', () => {
    it('throws if no access token', async () => {
      (getFreshStoredTokens as jest.Mock).mockResolvedValue(null);
      const store = createTestStore();
      await store.dispatch(fetchAppointmentsForCompanion({ companionId: 'c1' }));
      // FIX: Cast state to any to access properties safely
      const state = (store.getState() as any).appointments;
      expect(state.error).toBe('Missing access token. Please sign in again.');
    });

    it('throws if token expired', async () => {
      (getFreshStoredTokens as jest.Mock).mockResolvedValue({ accessToken: 'expired', expiresAt: 123 });
      (isTokenExpired as jest.Mock).mockReturnValue(true);
      const store = createTestStore();
      await store.dispatch(fetchAppointmentsForCompanion({ companionId: 'c1' }));
      const state = (store.getState() as any).appointments;
      expect(state.error).toBe('Your session expired. Please sign in again.');
    });
  });

  // --- fetchAppointmentsForCompanion ---

  describe('fetchAppointmentsForCompanion', () => {
    it('handles pending/fulfilled', async () => {
      (appointmentApi.listAppointments as jest.Mock).mockResolvedValue([mockAppointment]);
      const store = createTestStore();

      const promise = store.dispatch(fetchAppointmentsForCompanion({ companionId: 'comp-1' }));
      expect((store.getState() as any).appointments.loading).toBe(true);

      await promise;

      const state = (store.getState() as any).appointments;
      expect(state.loading).toBe(false);
      expect(state.items).toHaveLength(1);
      expect(state.hydratedCompanions['comp-1']).toBe(true);
    });

    it('replaces existing items for companion', async () => {
      const oldAppt = { ...mockAppointment, id: 'old-1', companionId: 'comp-1' };
      const otherAppt = { ...mockAppointment, id: 'other-1', companionId: 'comp-2' };
      const store = createTestStore({ items: [oldAppt, otherAppt] });

      (appointmentApi.listAppointments as jest.Mock).mockResolvedValue([mockAppointment]);
      await store.dispatch(fetchAppointmentsForCompanion({ companionId: 'comp-1' }));

      const items = (store.getState() as any).appointments.items;
      expect(items).toHaveLength(2);
      // FIX: Added (i: any) type annotation
      expect(items.find((i: any) => i.id === 'old-1')).toBeUndefined();
      expect(items.find((i: any) => i.id === 'other-1')).toBeDefined();
    });

    it('handles rejected', async () => {
      const error = new Error('Network Error');
      (appointmentApi.listAppointments as jest.Mock).mockRejectedValue(error);
      const store = createTestStore();
      await store.dispatch(fetchAppointmentsForCompanion({ companionId: 'c1' }));
      expect((store.getState() as any).appointments.error).toBe('Network Error');
    });

    it('handles rejected with non-Error object', async () => {
       (appointmentApi.listAppointments as jest.Mock).mockRejectedValue('String Error');
       const store = createTestStore();
       await store.dispatch(fetchAppointmentsForCompanion({ companionId: 'c1' }));
       expect((store.getState() as any).appointments.error).toBe('Unable to fetch appointments');
    });
  });

  // --- fetchAppointmentById ---

  describe('fetchAppointmentById', () => {
    it('upserts appointment on fulfilled', async () => {
      (appointmentApi.getAppointment as jest.Mock).mockResolvedValue(mockAppointment);
      const store = createTestStore();
      await store.dispatch(fetchAppointmentById({ appointmentId: 'appt-1' }));
      expect((store.getState() as any).appointments.items[0]).toEqual(mockAppointment);
    });

    it('updates existing appointment', async () => {
      const existing = { ...mockAppointment, status: 'PENDING' };
      const store = createTestStore({ items: [existing] });
      (appointmentApi.getAppointment as jest.Mock).mockResolvedValue({ ...mockAppointment, status: 'CONFIRMED' });
      await store.dispatch(fetchAppointmentById({ appointmentId: 'appt-1' }));
      expect((store.getState() as any).appointments.items[0].status).toBe('CONFIRMED');
    });

    it('handles error', async () => {
      (appointmentApi.getAppointment as jest.Mock).mockRejectedValue(new Error('Fail'));
      const store = createTestStore();
      const result = await store.dispatch(fetchAppointmentById({ appointmentId: 'appt-1' }));
      expect(result.type).toBe('appointments/fetchById/rejected');
      expect(result.payload).toBe('Fail');
    });
  });

  // --- createAppointment ---

  describe('createAppointment', () => {
    const bookPayload = {
      businessId: 'biz-1',
      serviceId: 'srv-1',
      serviceName: 'Exam',
      date: '2023-12-01',
      startTime: '10:00',
      endTime: '10:15',
      companionId: 'comp-1',
    };

    it('creates successfully with invoice returned', async () => {
      (appointmentApi.bookAppointment as jest.Mock).mockResolvedValue({
        appointment: mockAppointment,
        invoice: mockInvoice,
        paymentIntent: null,
      });

      const store = createTestStore();
      await store.dispatch(createAppointment(bookPayload));

      const state = (store.getState() as any).appointments;
      expect(state.items[0]).toEqual(mockAppointment);
      expect(state.invoices[0]).toEqual(expect.objectContaining({ id: 'inv-1' }));
      expect(state.hydratedCompanions['comp-1']).toBe(true);
    });

    it('creates successfully without invoice (generates pending)', async () => {
      const pi = { paymentIntentId: 'pi_new', amount: 50, currency: 'USD' };
      (appointmentApi.bookAppointment as jest.Mock).mockResolvedValue({
        appointment: mockAppointment,
        invoice: null,
        paymentIntent: pi,
      });

      const store = createTestStore();
      await store.dispatch(createAppointment(bookPayload));

      const state = (store.getState() as any).appointments;
      expect(state.invoices[0]).toEqual(expect.objectContaining({
        id: 'pi_new',
        status: 'AWAITING_PAYMENT',
        total: 50,
      }));
    });

    it('creates successfully without invoice and minimal paymentIntent', async () => {
      const pi = { paymentIntentId: undefined, amount: 50, currency: 'USD' };
      (appointmentApi.bookAppointment as jest.Mock).mockResolvedValue({
        appointment: mockAppointment,
        invoice: null,
        paymentIntent: pi,
      });

      const store = createTestStore();
      await store.dispatch(createAppointment(bookPayload));

      const state = (store.getState() as any).appointments;
      expect(state.invoices[0].id).toBe(`pending-${mockAppointment.id}`);
      expect(state.invoices[0].invoiceNumber).toBe(`pending-${mockAppointment.id}`);
    });

    it('calculates end time and duration correctly', async () => {
        const payloadNoEnd = { ...bookPayload, endTime: '' };
        (appointmentApi.bookAppointment as jest.Mock).mockResolvedValue({ appointment: mockAppointment });

        const store = createTestStore();
        await store.dispatch(createAppointment(payloadNoEnd));

        const lastCall = (appointmentApi.bookAppointment as jest.Mock).mock.calls.slice(-1)[0][0];
        expect(lastCall.payload.minutesDuration).toBe(15);

        const payloadUtc = { ...bookPayload, startTimeUtc: '2023-01-01T10:00:00Z', endTimeUtc: '2023-01-01T10:30:00Z' };
        await store.dispatch(createAppointment(payloadUtc));

        const lastCallUtc = (appointmentApi.bookAppointment as jest.Mock).mock.calls.slice(-1)[0][0];
        expect(lastCallUtc.payload.start).toBe('2023-01-01T10:00:00Z');
        expect(lastCallUtc.payload.minutesDuration).toBe(30);
    });

    it('handles attachments and FHIR extensions', async () => {
        const payloadWithAtt = {
            ...bookPayload,
            attachments: [
                { key: 'k1', name: 'n1', contentType: 'image/png' },
                { key: 'k2' }
            ],
            emergency: true
        };
        (appointmentApi.bookAppointment as jest.Mock).mockResolvedValue({ appointment: mockAppointment });

        const store = createTestStore();
        await store.dispatch(createAppointment(payloadWithAtt));

        const callArg = (appointmentApi.bookAppointment as jest.Mock).mock.calls.slice(-1)[0][0].payload;

        // FIX: Added (e: any) type annotation
        const emergencyExt = callArg.extension.find((e: any) => e.url.includes('is-emergency'));
        expect(emergencyExt.valueBoolean).toBe(true);

        // FIX: Added (e: any) type annotation
        const attExt = callArg.extension.filter((e: any) => e.url.includes('appointment-attachments'));
        expect(attExt).toHaveLength(2);
        expect(attExt[1].extension.find((e: any) => e.url === 'name').valueString).toBe('k2');
    });

    it('maps participant actors correctly', async () => {
        const store = createTestStore();
        await store.dispatch(createAppointment(bookPayload));

        const callArg = (appointmentApi.bookAppointment as jest.Mock).mock.calls.slice(-1)[0][0].payload;
        // FIX: Added (p: any) type annotation
        const relatedPerson = callArg.participant.find((p: any) => p.actor.reference.startsWith('RelatedPerson'));
        expect(relatedPerson.actor.reference).toBe('RelatedPerson/user-1');

        const storeWithParent = configureStore({
            reducer: {
              appointments: appointmentsReducer,
              // FIX: Explicitly cast mock reducers
              companion: (state: any = { companions: [] }) => state,
              auth: (state: any = { user: { id: 'u1', parentId: 'p1', email: 'e@e.com' } }) => state,
            } as any
        });
        await storeWithParent.dispatch(createAppointment(bookPayload));
        const callArg2 = (appointmentApi.bookAppointment as jest.Mock).mock.calls.slice(-1)[0][0].payload;
        const relatedPerson2 = callArg2.participant.find((p: any) => p.actor.reference.startsWith('RelatedPerson'));
        expect(relatedPerson2.actor.reference).toBe('RelatedPerson/p1');
        expect(relatedPerson2.actor.display).toBe('e@e.com');
    });

    it('handles rejection', async () => {
      (appointmentApi.bookAppointment as jest.Mock).mockRejectedValue(new Error('Booking Failed'));
      const store = createTestStore();
      const result = await store.dispatch(createAppointment(bookPayload));
      expect(result.payload).toBe('Booking Failed');
    });
  });

  // --- updateAppointmentStatus ---

  describe('updateAppointmentStatus', () => {
    it('updates status locally on success', async () => {
      (appointmentApi.getAppointment as jest.Mock).mockResolvedValue(mockAppointment);
      const store = createTestStore();
      await store.dispatch(updateAppointmentStatus({ appointmentId: 'a1', status: 'ARRIVED' }));

      const item = (store.getState() as any).appointments.items[0];
      expect(item.status).toBe('ARRIVED');
    });

    it('handles employeeId update', async () => {
      (appointmentApi.getAppointment as jest.Mock).mockResolvedValue(mockAppointment);
      const store = createTestStore();
      await store.dispatch(updateAppointmentStatus({ appointmentId: 'a1', status: 'FULFILLED', employeeId: 'emp-99' }));

      const item = (store.getState() as any).appointments.items[0];
      expect(item.employeeId).toBe('emp-99');
    });

    it('handles error', async () => {
      (appointmentApi.getAppointment as jest.Mock).mockRejectedValue(new Error('Update failed'));
      const store = createTestStore();
      const result = await store.dispatch(updateAppointmentStatus({ appointmentId: 'a1', status: 'ARRIVED' }));
      expect(result.payload).toBe('Update failed');
    });
  });

  // --- checkInAppointment ---
  it('checkInAppointment calls API and upserts', async () => {
    (appointmentApi.checkInAppointment as jest.Mock).mockResolvedValue({ ...mockAppointment, status: 'ARRIVED' });
    const store = createTestStore();
    await store.dispatch(checkInAppointment({ appointmentId: 'a1' }));
    expect((store.getState() as any).appointments.items[0].status).toBe('ARRIVED');
  });

  it('checkInAppointment handles error', async () => {
     (appointmentApi.checkInAppointment as jest.Mock).mockRejectedValue(new Error('Err'));
     const store = createTestStore();
     const res = await store.dispatch(checkInAppointment({ appointmentId: 'a1' }));
     expect(res.payload).toBe('Err');
  });

  // --- rescheduleAppointment ---
  it('rescheduleAppointment calls API and upserts', async () => {
     const updated = { ...mockAppointment, start: 'new-time' };
     (appointmentApi.rescheduleAppointment as jest.Mock).mockResolvedValue(updated);
     const store = createTestStore();
     await store.dispatch(rescheduleAppointment({ appointmentId: 'a1', startTime: '', endTime: '', isEmergency: false, concern: '' }));
     expect((store.getState() as any).appointments.items[0].start).toBe('new-time');
  });

  it('rescheduleAppointment handles error', async () => {
    (appointmentApi.rescheduleAppointment as jest.Mock).mockRejectedValue(new Error('Err'));
    const store = createTestStore();
    const res = await store.dispatch(rescheduleAppointment({ appointmentId: 'a1', startTime: '', endTime: '', isEmergency: false, concern: '' }));
    expect(res.payload).toBe('Err');
  });

  // --- cancelAppointment ---
  it('cancelAppointment calls API and upserts normalized status', async () => {
     (appointmentApi.cancelAppointment as jest.Mock).mockResolvedValue({ id: 'a1' }); // status missing
     const store = createTestStore();
     await store.dispatch(cancelAppointment({ appointmentId: 'a1' }));
     expect((store.getState() as any).appointments.items[0].status).toBe('CANCELLED');
  });

  it('cancelAppointment handles error', async () => {
    (appointmentApi.cancelAppointment as jest.Mock).mockRejectedValue(new Error('Err'));
    const store = createTestStore();
    const res = await store.dispatch(cancelAppointment({ appointmentId: 'a1' }));
    expect(res.payload).toBe('Err');
  });

  // --- fetchPaymentIntentForAppointment ---
  describe('fetchPaymentIntentForAppointment', () => {
     it('updates item and invoice with intent', async () => {
         const intent = { paymentIntentId: 'pi_new', amount: 50 };
         (appointmentApi.createPaymentIntent as jest.Mock).mockResolvedValue(intent);

         const store = createTestStore({
             items: [mockAppointment],
             invoices: [{ id: 'inv-1', appointmentId: 'appt-1' }]
         });

         await store.dispatch(fetchPaymentIntentForAppointment({ appointmentId: 'appt-1' }));

         const state = (store.getState() as any).appointments;
         expect(state.items[0].paymentIntent).toEqual(intent);
         expect(state.invoices[0].paymentIntent).toEqual(intent);
         expect(state.invoices[0].invoiceNumber).toBe('pi_new');
     });

     it('handles error', async () => {
        (appointmentApi.createPaymentIntent as jest.Mock).mockRejectedValue(new Error('Err'));
        const store = createTestStore();
        const res = await store.dispatch(fetchPaymentIntentForAppointment({ appointmentId: 'a1' }));
        expect(res.payload).toBe('Err');
     });
  });

  // --- recordPayment ---
  describe('recordPayment', () => {
      it('uses refreshed status if valid', async () => {
         (appointmentApi.getAppointment as jest.Mock).mockResolvedValue({ id: 'a1', status: 'ARRIVED' });
         const store = createTestStore();
         await store.dispatch(recordPayment({ appointmentId: 'a1' }));
         expect((store.getState() as any).appointments.items[0].status).toBe('ARRIVED');
      });

      // Logic Check: status is NO_PAYMENT -> slice forces PAID
      it('infers PAID if status is NO_PAYMENT', async () => {
         (appointmentApi.getAppointment as jest.Mock).mockResolvedValue({ id: 'a1', status: 'NO_PAYMENT' });
         const store = createTestStore();
         await store.dispatch(recordPayment({ appointmentId: 'a1' }));
         expect((store.getState() as any).appointments.items[0].status).toBe('PAID');
      });

      it('infers PAID if status is AWAITING_PAYMENT', async () => {
         (appointmentApi.getAppointment as jest.Mock).mockResolvedValue({ id: 'a1', status: 'AWAITING_PAYMENT' });
         const store = createTestStore();
         await store.dispatch(recordPayment({ appointmentId: 'a1' }));
         expect((store.getState() as any).appointments.items[0].status).toBe('PAID');
      });

      it('infers PAID if status is undefined', async () => {
         (appointmentApi.getAppointment as jest.Mock).mockResolvedValue({ id: 'a1' });
         const store = createTestStore();
         await store.dispatch(recordPayment({ appointmentId: 'a1' }));
         expect((store.getState() as any).appointments.items[0].status).toBe('PAID');
      });

      it('handles error', async () => {
         (appointmentApi.getAppointment as jest.Mock).mockRejectedValue(new Error('Err'));
         const store = createTestStore();
         const res = await store.dispatch(recordPayment({ appointmentId: 'a1' }));
         expect(res.payload).toBe('Err');
      });
  });

  // --- fetchInvoiceForAppointment ---
  describe('fetchInvoiceForAppointment', () => {
      it('merges invoice into state', async () => {
          (appointmentApi.fetchInvoiceForAppointment as jest.Mock).mockResolvedValue({
              invoice: mockInvoice,
              paymentIntent: { paymentIntentId: 'pi_old' }
          });

          const store = createTestStore({ invoices: [{ ...mockInvoice, status: 'PENDING' }] });

          await store.dispatch(fetchInvoiceForAppointment({ appointmentId: 'appt-1' }));

          const state = (store.getState() as any).appointments;
          expect(state.invoices[0].status).toBe('PAID');
          expect(state.invoices[0].paymentIntent).toEqual({ paymentIntentId: 'pi_old' });
      });

      it('pushes new invoice if not found', async () => {
          (appointmentApi.fetchInvoiceForAppointment as jest.Mock).mockResolvedValue({
              invoice: mockInvoice,
              paymentIntent: null
          });
          const store = createTestStore();
          await store.dispatch(fetchInvoiceForAppointment({ appointmentId: 'appt-1' }));
          expect((store.getState() as any).appointments.invoices).toHaveLength(1);
      });

      it('updates appointment item with paymentIntent', async () => {
          (appointmentApi.fetchInvoiceForAppointment as jest.Mock).mockResolvedValue({
              invoice: null,
              paymentIntent: { paymentIntentId: 'pi_new' }
          });
          const store = createTestStore({ items: [mockAppointment] });
          await store.dispatch(fetchInvoiceForAppointment({ appointmentId: 'appt-1' }));
          expect((store.getState() as any).appointments.items[0].paymentIntent).toEqual({ paymentIntentId: 'pi_new' });
      });

      it('handles error', async () => {
        (appointmentApi.fetchInvoiceForAppointment as jest.Mock).mockRejectedValue(new Error('Err'));
        const store = createTestStore();
        const res = await store.dispatch(fetchInvoiceForAppointment({ appointmentId: 'a1' }));
        expect(res.payload).toBe('Err');
      });
  });

});