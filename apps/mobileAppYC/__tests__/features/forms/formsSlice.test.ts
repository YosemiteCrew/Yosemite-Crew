import {configureStore} from '@reduxjs/toolkit';
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
import {
  formApi,
  mapAppointmentFormItem,
} from '../../../src/features/forms/services/formService';
import {
  getFreshStoredTokens,
  isTokenExpired,
} from '../../../src/features/auth/sessionManager';
import * as Utils from '../../../src/features/forms/utils';

jest.mock('../../../src/features/forms/services/formService', () => ({
  formApi: {
    fetchFormsForAppointment: jest.fn(),
    submitForm: jest.fn(),
    startSigning: jest.fn(),
  },
  mapAppointmentFormItem: jest.fn(item => item),
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

type TestStore = ReturnType<typeof makeStore>;

const mockAppointmentId = 'appt-123';
const mockAccessToken = 'access-token-123';
const mockUserId = 'user-123';

const makeStore = (
  authState = {user: {id: mockUserId, parentId: 'parent-123'}},
) =>
  configureStore({
    reducer: {
      forms: formsReducer,
      auth: (state = authState) => state,
    },
  });

const mockForm = (overrides: Record<string, any> = {}) => ({
  _id: 'form-1',
  name: 'Intake',
  category: 'general',
  schema: [],
  ...overrides,
});

const mockSubmission = (overrides: Record<string, any> = {}) => ({
  _id: 'sub-1',
  formId: 'form-1',
  appointmentId: mockAppointmentId,
  answers: {},
  ...overrides,
});

describe('formsSlice', () => {
  let store: TestStore;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    store = makeStore();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    (getFreshStoredTokens as jest.Mock).mockResolvedValue({
      accessToken: mockAccessToken,
      userId: mockUserId,
      expiresAt: Date.now() + 60_000,
    });
    (isTokenExpired as jest.Mock).mockReturnValue(false);
    (mapAppointmentFormItem as jest.Mock).mockImplementation(item => item);
    (Utils.normalizeFormForState as jest.Mock).mockImplementation(form => form);
    (Utils.normalizeSubmissionFromApi as jest.Mock).mockImplementation(
      submission => submission,
    );
    (Utils.hasSignatureField as jest.Mock).mockReturnValue(false);
    (Utils.deriveFormStatus as jest.Mock).mockReturnValue('pending');
    (Utils.resolveFormVersion as jest.Mock).mockReturnValue(1);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('selectors and reducers', () => {
    const state: any = {
      forms: {
        byAppointmentId: {'appt-1': [{form: {_id: 'f1'}, status: 'pending'}]},
        loadingByAppointment: {'appt-1': true},
        submittingByForm: {f1: true},
        signingBySubmission: {'sub-1': true},
        error: 'some error',
        formsCache: {f1: {_id: 'f1'}},
      },
    };

    it('selects forms, loading, submit, and signing status with safe defaults', () => {
      expect(selectFormsForAppointment(state, 'appt-1')).toHaveLength(1);
      expect(selectFormsForAppointment(state, 'missing')).toEqual([]);
      expect(selectFormsLoading(state, 'appt-1')).toBe(true);
      expect(selectFormsLoading(state, 'missing')).toBe(false);
      expect(selectFormSubmitting(state, 'f1')).toBe(true);
      expect(selectFormSubmitting(state, 'missing')).toBe(false);
      expect(selectSigningStatus(state, 'sub-1')).toBe(true);
      expect(selectSigningStatus(state, 'missing')).toBe(false);
    });

    it('resets to the initial state', () => {
      const nextState = formsReducer(state.forms, resetFormsState());
      expect(nextState).toEqual({
        byAppointmentId: {},
        loadingByAppointment: {},
        submittingByForm: {},
        signingBySubmission: {},
        error: null,
        formsCache: {},
      });
    });
  });

  describe('fetchAppointmentForms', () => {
    it('fetches appointment forms, normalizes submissions, updates loading, and caches forms', async () => {
      const form = mockForm();
      const submission = mockSubmission({
        submittedBy: 'vet-1',
        submittedAt: '2026-01-01',
      });
      (formApi.fetchFormsForAppointment as jest.Mock).mockResolvedValue({
        items: [{form, submission, formVersion: 3}],
      });
      (Utils.normalizeFormForState as jest.Mock).mockImplementation(
        incoming => ({
          ...incoming,
          normalized: true,
        }),
      );
      (Utils.normalizeSubmissionFromApi as jest.Mock).mockImplementation(
        incoming => ({
          ...incoming,
          normalizedSubmission: true,
        }),
      );
      (Utils.deriveFormStatus as jest.Mock).mockReturnValue('submitted');

      const action = await store.dispatch(
        fetchAppointmentForms({
          appointmentId: mockAppointmentId,
          serviceId: 'svc-1',
          species: 'canine',
          organisationId: 'ignored-by-current-slice',
        }),
      );

      expect(action.type).toBe(fetchAppointmentForms.fulfilled.type);
      expect(formApi.fetchFormsForAppointment).toHaveBeenCalledWith({
        appointmentId: mockAppointmentId,
        serviceId: 'svc-1',
        species: 'canine',
        accessToken: mockAccessToken,
      });
      expect(Utils.normalizeSubmissionFromApi).toHaveBeenCalledWith(
        submission,
        form.schema,
        expect.objectContaining({
          formId: form._id,
          formVersion: 3,
          appointmentId: mockAppointmentId,
          submittedAt: submission.submittedAt,
          submittedBy: submission.submittedBy,
        }),
      );

      const state = store.getState().forms;
      expect(state.loadingByAppointment[mockAppointmentId]).toBe(false);
      expect(state.byAppointmentId[mockAppointmentId]).toEqual([
        expect.objectContaining({
          form: expect.objectContaining({_id: form._id, normalized: true}),
          submission: expect.objectContaining({
            _id: submission._id,
            normalizedSubmission: true,
          }),
          status: 'submitted',
          signingRequired: false,
          signingUrl: null,
          source: 'appointment',
          formVersion: 3,
        }),
      ]);
      expect(state.formsCache[form._id]).toEqual(
        expect.objectContaining({_id: form._id, normalized: true}),
      );
      expect(state.error).toBeNull();
    });

    it('reuses existing cached forms when building the returned cache object', async () => {
      store = makeStore();
      await store.dispatch({
        type: fetchAppointmentForms.fulfilled.type,
        payload: {
          appointmentId: 'seed',
          forms: [],
          cache: {'cached-form': mockForm({_id: 'cached-form'})},
        },
      });
      (formApi.fetchFormsForAppointment as jest.Mock).mockResolvedValue({
        items: [],
      });

      await store.dispatch(
        fetchAppointmentForms({appointmentId: mockAppointmentId}),
      );

      expect(store.getState().forms.formsCache['cached-form']).toBeDefined();
    });

    it('sets consent forms as signing-required based on category', async () => {
      (formApi.fetchFormsForAppointment as jest.Mock).mockResolvedValue({
        items: [
          {form: mockForm({category: 'Consent Agreement'}), submission: null},
        ],
      });

      await store.dispatch(
        fetchAppointmentForms({appointmentId: mockAppointmentId}),
      );

      expect(Utils.hasSignatureField).not.toHaveBeenCalled();
      expect(Utils.deriveFormStatus).toHaveBeenCalledWith(null, true);
      expect(
        store.getState().forms.byAppointmentId[mockAppointmentId][0]
          .signingRequired,
      ).toBe(true);
    });

    it('sets signing-required from submission.signing.required before checking form category/schema', async () => {
      (formApi.fetchFormsForAppointment as jest.Mock).mockResolvedValue({
        items: [
          {
            form: mockForm(),
            submission: mockSubmission({signing: {required: true}}),
          },
        ],
      });

      await store.dispatch(
        fetchAppointmentForms({appointmentId: mockAppointmentId}),
      );

      expect(Utils.hasSignatureField).not.toHaveBeenCalled();
      expect(Utils.deriveFormStatus).toHaveBeenCalledWith(
        expect.objectContaining({_id: 'sub-1'}),
        true,
      );
    });

    it('sets signing-required from hasSignatureField when form is not consent and submission does not require signing', async () => {
      (Utils.hasSignatureField as jest.Mock).mockReturnValue(true);
      (formApi.fetchFormsForAppointment as jest.Mock).mockResolvedValue({
        items: [
          {form: mockForm({schema: [{type: 'signature'}]}), submission: null},
        ],
      });

      await store.dispatch(
        fetchAppointmentForms({appointmentId: mockAppointmentId}),
      );

      expect(Utils.hasSignatureField).toHaveBeenCalledWith([
        {type: 'signature'},
      ]);
      expect(
        store.getState().forms.byAppointmentId[mockAppointmentId][0]
          .signingRequired,
      ).toBe(true);
    });

    it('handles undefined response/items as an empty successful result', async () => {
      (formApi.fetchFormsForAppointment as jest.Mock).mockResolvedValue(
        undefined,
      );

      const action = await store.dispatch(
        fetchAppointmentForms({appointmentId: mockAppointmentId}),
      );

      expect(action.type).toBe(fetchAppointmentForms.fulfilled.type);
      expect(store.getState().forms.byAppointmentId[mockAppointmentId]).toEqual(
        [],
      );
      expect(store.getState().forms.error).toBeNull();
    });

    it('logs appointment fetch failures but fulfills with an empty list', async () => {
      (formApi.fetchFormsForAppointment as jest.Mock).mockRejectedValue(
        new Error('API Fail'),
      );

      const action = await store.dispatch(
        fetchAppointmentForms({appointmentId: mockAppointmentId}),
      );

      expect(action.type).toBe(fetchAppointmentForms.fulfilled.type);
      expect(warnSpy).toHaveBeenCalledWith(
        '[Forms] Unable to load forms for appointment',
        mockAppointmentId,
        expect.any(Error),
      );
      expect(store.getState().forms.byAppointmentId[mockAppointmentId]).toEqual(
        [],
      );
    });

    it('rejects when access token is missing', async () => {
      (getFreshStoredTokens as jest.Mock).mockResolvedValue({
        accessToken: null,
      });

      const action = await store.dispatch(
        fetchAppointmentForms({appointmentId: mockAppointmentId}),
      );

      expect(action.type).toBe(fetchAppointmentForms.rejected.type);
      expect(store.getState().forms.error).toContain('Missing access token');
      expect(
        store.getState().forms.loadingByAppointment[mockAppointmentId],
      ).toBe(false);
    });

    it('rejects when the stored token is expired', async () => {
      (isTokenExpired as jest.Mock).mockReturnValue(true);

      const action = await store.dispatch(
        fetchAppointmentForms({appointmentId: mockAppointmentId}),
      );

      expect(action.type).toBe(fetchAppointmentForms.rejected.type);
      expect(store.getState().forms.error).toContain('session expired');
    });

    it('merges pending entries by form/source and preserves existing submission/signingUrl/formVersion values when incoming omits them', async () => {
      (formApi.fetchFormsForAppointment as jest.Mock)
        .mockResolvedValueOnce({
          items: [
            {form: mockForm(), submission: mockSubmission(), formVersion: 7},
          ],
        })
        .mockResolvedValueOnce({
          items: [
            {
              form: mockForm({name: 'Updated Intake'}),
              submission: mockSubmission({_id: 'sub-1'}),
              formVersion: undefined,
            },
          ],
        });
      (Utils.resolveFormVersion as jest.Mock).mockReturnValue(undefined);

      await store.dispatch(
        fetchAppointmentForms({appointmentId: mockAppointmentId}),
      );
      await store.dispatch(
        fetchAppointmentForms({appointmentId: mockAppointmentId}),
      );

      const entries = store.getState().forms.byAppointmentId[mockAppointmentId];
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual(
        expect.objectContaining({
          form: expect.objectContaining({name: 'Updated Intake'}),
          submission: expect.objectContaining({_id: 'sub-1'}),
          formVersion: undefined,
          signingUrl: null,
          signingRequired: false,
          status: 'pending',
        }),
      );
    });

    it('merges (updates) an existing pending entry when the same pending key appears in both existing and incoming', async () => {
      (formApi.fetchFormsForAppointment as jest.Mock)
        .mockResolvedValueOnce({items: [{form: mockForm(), submission: null}]})
        .mockResolvedValueOnce({
          items: [{form: mockForm({name: 'Updated Intake'}), submission: null}],
        });

      await store.dispatch(
        fetchAppointmentForms({appointmentId: mockAppointmentId}),
      );
      await store.dispatch(
        fetchAppointmentForms({appointmentId: mockAppointmentId}),
      );

      const entries = store.getState().forms.byAppointmentId[mockAppointmentId];
      expect(entries).toHaveLength(1);
      expect(entries[0].form.name).toBe('Updated Intake');
      expect(entries[0].submission).toBeNull();
    });

    it('drops pending entries for the same form when a submission arrives, and ignores later pending duplicates', async () => {
      (formApi.fetchFormsForAppointment as jest.Mock)
        .mockResolvedValueOnce({items: [{form: mockForm(), submission: null}]})
        .mockResolvedValueOnce({
          items: [
            {form: mockForm(), submission: mockSubmission({_id: 'sub-1'})},
          ],
        })
        .mockResolvedValueOnce({items: [{form: mockForm(), submission: null}]});

      await store.dispatch(
        fetchAppointmentForms({appointmentId: mockAppointmentId}),
      );
      await store.dispatch(
        fetchAppointmentForms({appointmentId: mockAppointmentId}),
      );
      await store.dispatch(
        fetchAppointmentForms({appointmentId: mockAppointmentId}),
      );

      const entries = store.getState().forms.byAppointmentId[mockAppointmentId];
      expect(entries).toHaveLength(1);
      expect(entries[0].submission?._id).toBe('sub-1');
    });
  });

  describe('submitAppointmentForm', () => {
    it('builds a submission payload, submits it, updates state, and caches the form', async () => {
      const form = mockForm({_id: 'f1', schema: [{id: 'q1'}]});
      const savedSubmission = mockSubmission({
        _id: 'saved-sub',
        formId: 'f1',
        formVersion: 2,
      });
      (formApi.submitForm as jest.Mock).mockResolvedValue(savedSubmission);
      (Utils.resolveFormVersion as jest.Mock).mockReturnValue(2);

      const action = await store.dispatch(
        submitAppointmentForm({
          appointmentId: mockAppointmentId,
          form: form as any,
          answers: {q1: 'answer'},
          companionId: 'companion-1',
        }),
      );

      expect(action.type).toBe(submitAppointmentForm.fulfilled.type);
      expect(formApi.submitForm).toHaveBeenCalledWith({
        formId: 'f1',
        schema: form.schema,
        accessToken: mockAccessToken,
        submission: expect.objectContaining({
          _id: '',
          formId: 'f1',
          formVersion: 2,
          appointmentId: mockAppointmentId,
          companionId: 'companion-1',
          parentId: 'parent-123',
          submittedBy: mockUserId,
          answers: {q1: 'answer'},
          submittedAt: expect.any(Date),
        }),
      });
      expect(store.getState().forms.submittingByForm.f1).toBe(false);
      expect(
        store.getState().forms.byAppointmentId[mockAppointmentId][0].submission,
      ).toEqual(savedSubmission);
      expect(store.getState().forms.formsCache.f1).toEqual(form);
    });

    it('uses provided formVersion and falls back to user.id when parentId is missing', async () => {
      store = makeStore({user: {id: 'auth-user-without-parent'}});
      (formApi.submitForm as jest.Mock).mockResolvedValue(
        mockSubmission({_id: 'saved-sub'}),
      );

      await store.dispatch(
        submitAppointmentForm({
          appointmentId: mockAppointmentId,
          form: mockForm({_id: 'f1'}) as any,
          answers: {},
          formVersion: 9,
        }),
      );

      expect(formApi.submitForm).toHaveBeenCalledWith(
        expect.objectContaining({
          submission: expect.objectContaining({
            formVersion: 9,
            parentId: 'auth-user-without-parent',
          }),
        }),
      );
      expect(Utils.resolveFormVersion).not.toHaveBeenCalledWith(
        expect.objectContaining({_id: 'f1'}),
      );
    });

    it('falls back to token userId and formVersion 1 when auth user and resolved version are missing', async () => {
      store = makeStore({user: null});
      (Utils.resolveFormVersion as jest.Mock).mockReturnValue(undefined);
      (formApi.submitForm as jest.Mock).mockResolvedValue(
        mockSubmission({_id: 'saved-sub'}),
      );

      await store.dispatch(
        submitAppointmentForm({
          appointmentId: mockAppointmentId,
          form: mockForm({_id: 'f1'}) as any,
          answers: {},
        }),
      );

      expect(formApi.submitForm).toHaveBeenCalledWith(
        expect.objectContaining({
          submission: expect.objectContaining({
            formVersion: 1,
            parentId: mockUserId,
            submittedBy: mockUserId,
          }),
        }),
      );
    });

    it('rejects and stores an error when submitForm fails', async () => {
      (formApi.submitForm as jest.Mock).mockRejectedValue(
        new Error('Network Error'),
      );

      const action = await store.dispatch(
        submitAppointmentForm({
          appointmentId: mockAppointmentId,
          form: mockForm({_id: 'f1'}) as any,
          answers: {},
        }),
      );

      expect(action.type).toBe(submitAppointmentForm.rejected.type);
      expect(store.getState().forms.submittingByForm.f1).toBe(false);
      expect(store.getState().forms.error).toBe('Network Error');
    });

    it('rejects on auth failure during submit', async () => {
      (getFreshStoredTokens as jest.Mock).mockResolvedValue({
        accessToken: null,
      });

      const action = await store.dispatch(
        submitAppointmentForm({
          appointmentId: mockAppointmentId,
          form: mockForm({_id: 'f1'}) as any,
          answers: {},
        }),
      );

      expect(action.type).toBe(submitAppointmentForm.rejected.type);
      expect(store.getState().forms.error).toContain('Missing access token');
    });
  });

  describe('startFormSigning', () => {
    beforeEach(async () => {
      (formApi.fetchFormsForAppointment as jest.Mock).mockResolvedValue({
        items: [
          {
            form: mockForm({_id: 'f1'}),
            submission: mockSubmission({_id: 'sub-1', formId: 'f1'}),
          },
          {
            form: mockForm({_id: 'f2'}),
            submission: mockSubmission({_id: 'sub-2', formId: 'f2'}),
          },
        ],
      });
      await store.dispatch(
        fetchAppointmentForms({appointmentId: mockAppointmentId}),
      );
    });

    it('starts signing, updates only the matching entry, converts numeric documentId to string, and keeps existing entries unchanged', async () => {
      (formApi.startSigning as jest.Mock).mockResolvedValue({
        signingUrl: 'https://sign',
        documentId: 99,
      });

      const action = await store.dispatch(
        startFormSigning({
          appointmentId: mockAppointmentId,
          submissionId: 'sub-1',
        }),
      );

      expect(action.type).toBe(startFormSigning.fulfilled.type);
      expect(formApi.startSigning).toHaveBeenCalledWith({
        submissionId: 'sub-1',
        accessToken: mockAccessToken,
      });
      expect(store.getState().forms.signingBySubmission['sub-1']).toBe(false);

      const entries = store.getState().forms.byAppointmentId[mockAppointmentId];
      expect(
        entries.find((entry: any) => entry.submission._id === 'sub-1'),
      ).toEqual(
        expect.objectContaining({
          signingUrl: 'https://sign',
          submission: expect.objectContaining({
            signing: expect.objectContaining({
              required: true,
              provider: 'DOCUMENSO',
              status: 'IN_PROGRESS',
              documentId: '99',
            }),
          }),
        }),
      );
      expect(
        entries.find((entry: any) => entry.submission._id === 'sub-2')
          .signingUrl,
      ).toBeNull();
    });

    it('preserves existing signing fields and existing signingUrl when API omits new values', async () => {
      (formApi.fetchFormsForAppointment as jest.Mock).mockResolvedValue({
        items: [
          {
            form: mockForm({_id: 'f1'}),
            submission: mockSubmission({
              _id: 'sub-1',
              formId: 'f1',
              signing: {
                required: true,
                provider: 'DOCUMENSO',
                status: 'PENDING',
                documentId: 'old-doc',
              },
            }),
          },
        ],
      });
      await store.dispatch(
        fetchAppointmentForms({appointmentId: 'appt-existing-signing'}),
      );
      (formApi.startSigning as jest.Mock).mockResolvedValue({});

      await store.dispatch(
        startFormSigning({
          appointmentId: 'appt-existing-signing',
          submissionId: 'sub-1',
        }),
      );

      const entry =
        store.getState().forms.byAppointmentId['appt-existing-signing'][0];
      expect(entry.signingUrl).toBeNull();
      expect(entry.submission.signing).toEqual({
        required: true,
        provider: 'DOCUMENSO',
        status: 'IN_PROGRESS',
        documentId: 'old-doc',
      });
    });

    it('does not fail when no matching submission exists', async () => {
      (formApi.startSigning as jest.Mock).mockResolvedValue({
        signingUrl: 'unused',
      });

      await store.dispatch(
        startFormSigning({
          appointmentId: mockAppointmentId,
          submissionId: 'missing-sub',
        }),
      );

      expect(store.getState().forms.signingBySubmission['missing-sub']).toBe(
        false,
      );
      expect(
        store.getState().forms.byAppointmentId[mockAppointmentId],
      ).toHaveLength(2);
    });

    it('rejects and stores an error when signing fails', async () => {
      (formApi.startSigning as jest.Mock).mockRejectedValue(
        new Error('Sign Fail'),
      );

      const action = await store.dispatch(
        startFormSigning({
          appointmentId: mockAppointmentId,
          submissionId: 'sub-1',
        }),
      );

      expect(action.type).toBe(startFormSigning.rejected.type);
      expect(store.getState().forms.signingBySubmission['sub-1']).toBe(false);
      expect(store.getState().forms.error).toBe('Sign Fail');
    });

    it('rejects on auth failure during signing', async () => {
      (getFreshStoredTokens as jest.Mock).mockResolvedValue({
        accessToken: null,
      });

      const action = await store.dispatch(
        startFormSigning({
          appointmentId: mockAppointmentId,
          submissionId: 'sub-1',
        }),
      );

      expect(action.type).toBe(startFormSigning.rejected.type);
      expect(store.getState().forms.error).toContain('Missing access token');
    });
  });
});
