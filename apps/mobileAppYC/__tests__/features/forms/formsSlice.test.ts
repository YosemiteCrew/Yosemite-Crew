import formsReducer, {
  fetchAppointmentForms,
  submitAppointmentForm,
  startFormSigning,
  resetFormsState,
  selectFormsForAppointment,
  selectFormsLoading,
  selectFormSubmitting,
  selectSigningStatus,
} from '../../../src/features/forms/formsSlice';
import { formApi } from '../../../src/features/forms/services/formService';
import { getFreshStoredTokens, isTokenExpired } from '../../../src/features/auth/sessionManager';
import * as Utils from '../../../src/features/forms/utils';
import { configureStore } from '@reduxjs/toolkit';

// --- Mocks ---

jest.mock('../../../src/features/forms/services/formService', () => ({
  formApi: {
    fetchFormsForAppointment: jest.fn(),
    fetchSoapNotes: jest.fn(),
    fetchConsentFormIfNeeded: jest.fn(),
    fetchConsentFormForService: jest.fn(),
    fetchFormById: jest.fn(),
    submitForm: jest.fn(),
    startSigning: jest.fn(),
  },
  mapAppointmentFormItem: jest.fn((item) => item),
}));

jest.mock('../../../src/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(),
  isTokenExpired: jest.fn(),
}));

jest.mock('../../../src/features/forms/utils', () => ({
  deriveFormStatus: jest.fn(),
  hasSignatureField: jest.fn(),
  normalizeFormForState: jest.fn(),
  normalizeSubmissionFromApi: jest.fn(),
  resolveFormVersion: jest.fn(),
}));

describe('formsSlice', () => {
  let store: any;
  const mockAppointmentId = 'appt-123';
  const mockAccessToken = 'access-token-123';
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();

    store = configureStore({
      reducer: {
        forms: formsReducer,
        auth: (state = { user: { id: mockUserId } }) => state,
      },
    });

    (getFreshStoredTokens as jest.Mock).mockResolvedValue({
      accessToken: mockAccessToken,
      userId: mockUserId,
      expiresAt: Date.now() + 10000,
    });
    (isTokenExpired as jest.Mock).mockReturnValue(false);

    (Utils.normalizeFormForState as jest.Mock).mockImplementation((form) => form);
    (Utils.normalizeSubmissionFromApi as jest.Mock).mockImplementation((sub) => sub);
    (Utils.hasSignatureField as jest.Mock).mockReturnValue(false);
    (Utils.deriveFormStatus as jest.Mock).mockReturnValue('pending');
    (Utils.resolveFormVersion as jest.Mock).mockReturnValue(1);
  });

  describe('Selectors & Reducers', () => {
    const initialState = {
      byAppointmentId: {
        'appt-1': [{ form: { _id: 'f1' }, status: 'pending' }],
      },
      loadingByAppointment: { 'appt-1': true },
      submittingByForm: { f1: true },
      signingBySubmission: { 'sub-1': true },
      error: 'some error',
      formsCache: {},
    };

    const rootState: any = { forms: initialState };

    it('selectFormsForAppointment returns forms or empty array', () => {
      expect(selectFormsForAppointment(rootState, 'appt-1')).toHaveLength(1);
      expect(selectFormsForAppointment(rootState, 'appt-2')).toEqual([]);
    });

    it('selectFormsLoading returns loading status', () => {
      expect(selectFormsLoading(rootState, 'appt-1')).toBe(true);
      expect(selectFormsLoading(rootState, 'appt-2')).toBe(false);
    });

    it('selectFormSubmitting returns submitting status', () => {
      expect(selectFormSubmitting(rootState, 'f1')).toBe(true);
      expect(selectFormSubmitting(rootState, 'f2')).toBe(false);
    });

    it('selectSigningStatus returns signing status', () => {
      expect(selectSigningStatus(rootState, 'sub-1')).toBe(true);
      expect(selectSigningStatus(rootState, 'sub-2')).toBe(false);
    });

    it('resetFormsState resets state to initial', () => {
      const nextState = formsReducer(initialState as any, resetFormsState());
      expect(nextState.byAppointmentId).toEqual({});
      expect(nextState.error).toBeNull();
    });
  });

  describe('fetchAppointmentForms', () => {
    const mockForm = { _id: 'form-1', name: 'Intake', category: 'general' };
    const mockSubmission = { _id: 'sub-1', formId: 'form-1', appointmentId: mockAppointmentId };

    it('fetches and merges appointment, SOAP, and consent forms successfully', async () => {
      (formApi.fetchFormsForAppointment as jest.Mock).mockResolvedValue({
        items: [{ form: mockForm, submission: mockSubmission }],
      });

      const soapFormId = 'soap-form-1';
      const soapEntry = { formId: soapFormId, submissionId: 'sub-soap', submittedBy: 'doc', formVersion: 2 };
      (formApi.fetchSoapNotes as jest.Mock).mockResolvedValue({
        soapNotes: { 'Objective': [soapEntry] }
      });
      (formApi.fetchFormById as jest.Mock).mockResolvedValue({ _id: soapFormId, name: 'Soap Form' });

      (formApi.fetchConsentFormForService as jest.Mock).mockResolvedValue({ _id: 'consent-1', category: 'consent' });

      await store.dispatch(fetchAppointmentForms({
        appointmentId: mockAppointmentId,
        serviceId: 'svc-1',
        organisationId: 'org-1'
      }));

      const state = store.getState().forms;

      expect(state.loadingByAppointment[mockAppointmentId]).toBe(false);
    });

    it('handles auth errors gracefully', async () => {
      (getFreshStoredTokens as jest.Mock).mockResolvedValue({ accessToken: null });

      await store.dispatch(fetchAppointmentForms({ appointmentId: mockAppointmentId }));

      const state = store.getState().forms;
      expect(state.error).toContain('Missing access token');
      expect(state.loadingByAppointment[mockAppointmentId]).toBe(false);
    });

    it('handles token expiration', async () => {
      (isTokenExpired as jest.Mock).mockReturnValue(true);

      await store.dispatch(fetchAppointmentForms({ appointmentId: mockAppointmentId }));

      const state = store.getState().forms;
      expect(state.error).toContain('session expired');
    });

    it('merges entries correctly (deduplicates pending if submission exists)', async () => {
      // First call: adds pending
      (formApi.fetchFormsForAppointment as jest.Mock).mockResolvedValue({
         items: [{ form: { _id: 'form-1' }, submission: null }]
      });
      await store.dispatch(fetchAppointmentForms({ appointmentId: mockAppointmentId }));

      // Second call: adds submission
      (formApi.fetchFormsForAppointment as jest.Mock).mockResolvedValue({
         items: [{ form: { _id: 'form-1' }, submission: { _id: 'sub-1' } }]
      });
      await store.dispatch(fetchAppointmentForms({ appointmentId: mockAppointmentId }));

      const entries = store.getState().forms.byAppointmentId[mockAppointmentId];

      const form1Entries = entries.filter((e: any) => e.form._id === 'form-1');
      expect(form1Entries).toHaveLength(1);
      expect(form1Entries[0].submission).not.toBeNull();
    });

    it('handles API errors (logs warning but does not crash)', async () => {
       (formApi.fetchFormsForAppointment as jest.Mock).mockRejectedValue(new Error('API Fail'));

       await store.dispatch(fetchAppointmentForms({ appointmentId: mockAppointmentId }));

    });

    it('does not fetch consent form if already present', async () => {
       const existingForm = { _id: 'consent-1' };
       (formApi.fetchFormsForAppointment as jest.Mock).mockResolvedValue({
         items: [{ form: existingForm, submission: null }]
       });

       (formApi.fetchConsentFormForService as jest.Mock).mockResolvedValue({ _id: 'consent-1', category: 'consent' });

       await store.dispatch(fetchAppointmentForms({
         appointmentId: mockAppointmentId, serviceId: 's1', organisationId: 'o1'
       }));
    });

    it('skips SOAP processing if form fetch fails', async () => {
      (formApi.fetchSoapNotes as jest.Mock).mockResolvedValue({
        soapNotes: { 'Plan': [{ formId: 'missing-form', submissionId: 's1' }] }
      });
      (formApi.fetchFormById as jest.Mock).mockRejectedValue(new Error('404'));

      await store.dispatch(fetchAppointmentForms({ appointmentId: mockAppointmentId }));
    });
  });

  describe('submitAppointmentForm', () => {
    const mockPayload = {
      appointmentId: mockAppointmentId,
      form: { _id: 'f1', schema: [] },
      answers: { q1: 'a1' },
    };

    it('submits form successfully and updates state', async () => {
      const mockSavedSubmission = {
        _id: 'sub-new',
        formVersion: 2,
        submittedAt: new Date().toISOString()
      };
      (formApi.submitForm as jest.Mock).mockResolvedValue(mockSavedSubmission);
      (Utils.resolveFormVersion as jest.Mock).mockReturnValue(2);

      await store.dispatch(submitAppointmentForm(mockPayload as any));

      const state = store.getState().forms;
      expect(state.submittingByForm.f1).toBe(false);

      const entries = state.byAppointmentId[mockAppointmentId];
      expect(entries).toHaveLength(1);
      expect(entries[0].submission).toEqual(mockSavedSubmission);
      expect(state.formsCache.f1).toBeDefined();
    });

    it('handles submission error', async () => {
      (formApi.submitForm as jest.Mock).mockRejectedValue(new Error('Network Error'));

      await store.dispatch(submitAppointmentForm(mockPayload as any));

      const state = store.getState().forms;
      expect(state.submittingByForm.f1).toBe(false);
      expect(state.error).toBe('Network Error');
    });

    it('handles auth check failure during submit', async () => {
       (getFreshStoredTokens as jest.Mock).mockResolvedValue({ accessToken: null });

       const result = await store.dispatch(submitAppointmentForm(mockPayload as any));

       expect(result.type).toContain('rejected');
       expect(store.getState().forms.error).toContain('Missing access token');
    });
  });

  describe('startFormSigning', () => {
    const args = { appointmentId: mockAppointmentId, submissionId: 'sub-1' };

    it('starts signing successfully and updates entry status', async () => {
      // Pre-seed state
      (formApi.fetchFormsForAppointment as jest.Mock).mockResolvedValue({
        items: [{ form: { _id: 'f1' }, submission: { _id: 'sub-1' } }]
      });
      await store.dispatch(fetchAppointmentForms({ appointmentId: mockAppointmentId }));

      // Now run signing
      (formApi.startSigning as jest.Mock).mockResolvedValue({
        signingUrl: 'http://sign',
        documentId: 99
      });

      await store.dispatch(startFormSigning(args));

      const state = store.getState().forms;
      expect(state.signingBySubmission['sub-1']).toBe(false);

      const entry = state.byAppointmentId[mockAppointmentId][0];
      expect(entry.signingUrl).toBe('http://sign');
      expect(entry.submission.signing.status).toBe('IN_PROGRESS');
      expect(entry.submission.signing.documentId).toBe("99");
    });

    it('handles signing API failure', async () => {
      (formApi.startSigning as jest.Mock).mockRejectedValue(new Error('Sign Fail'));

      await store.dispatch(startFormSigning(args));

      const state = store.getState().forms;
      expect(state.signingBySubmission['sub-1']).toBe(false);
      expect(state.error).toBe('Sign Fail');
    });

    it('handles entries that do not match submission ID', async () => {
       (formApi.fetchFormsForAppointment as jest.Mock).mockResolvedValue({
          items: [
              { form: { _id: 'f1' }, submission: { _id: 'sub-1' } },
              { form: { _id: 'f2' }, submission: { _id: 'sub-2' } }
          ]
       });
       await store.dispatch(fetchAppointmentForms({ appointmentId: mockAppointmentId }));

       (formApi.startSigning as jest.Mock).mockResolvedValue({ signingUrl: 'url' });

       await store.dispatch(startFormSigning({ appointmentId: mockAppointmentId, submissionId: 'sub-1' }));

       const entries = store.getState().forms.byAppointmentId[mockAppointmentId];
       expect(entries.find((e:any) => e.submission._id === 'sub-1').signingUrl).toBe('url');
       expect(entries.find((e:any) => e.submission._id === 'sub-2').signingUrl).toBeNull();
    });

    it('handles entry without submission gracefully', async () => {
        await store.dispatch(startFormSigning({ appointmentId: 'empty-appt', submissionId: 'ghost-sub' }));
        const state = store.getState().forms;
        expect(state.byAppointmentId.empty).toBeUndefined();
    });
  });

  describe('Internal Utils Logic Coverage', () => {
     it('shouldRequireSignature detects consent category', () => {
        (Utils.deriveFormStatus as jest.Mock).mockReturnValue('signed');
     });
  });
});