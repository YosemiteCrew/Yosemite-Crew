import {createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import type {RootState} from '@/app/store';
import {getFreshStoredTokens, isTokenExpired} from '@/features/auth/sessionManager';
import type {Form, FormSubmission} from '@yosemite-crew/types';
import {formApi, mapAppointmentFormItem, type SoapNoteEntry, type SoapNotesResponse} from './services/formService';
import type {AppointmentFormEntry, AppointmentFormsState, FormSource} from './types';
import {
  deriveFormStatus,
  hasSignatureField,
  normalizeFormForState,
  normalizeSubmissionFromApi,
  resolveFormVersion,
} from './utils';

const ensureAccessToken = async (): Promise<{accessToken: string; userId?: string}> => {
  const tokens = await getFreshStoredTokens();
  const accessToken = tokens?.accessToken;

  if (!accessToken) {
    throw new Error('Missing access token. Please sign in again.');
  }

  if (isTokenExpired(tokens?.expiresAt ?? undefined)) {
    throw new Error('Your session expired. Please sign in again.');
  }

  return {accessToken, userId: tokens?.userId};
};

const shouldRequireSignature = (form: Form, submission?: FormSubmission | null): boolean => {
  if (submission?.signing?.required) {
    return true;
  }
  if ((form.category ?? '').toLowerCase().includes('consent')) {
    return true;
  }
  return hasSignatureField(form.schema);
};

const buildEntry = ({
  form,
  submission,
  source,
  formVersion,
  signingUrl,
  soapSection,
}: {
  form: Form;
  submission?: FormSubmission | null;
  source: FormSource;
  formVersion?: number;
  signingUrl?: string | null;
  soapSection?: string;
}): AppointmentFormEntry => {
  const normalizedForm = normalizeFormForState(form);
  const normalizedSubmission = submission
    ? normalizeSubmissionFromApi(submission, normalizedForm.schema, {
        formId: normalizedForm._id,
        formVersion,
        appointmentId: submission.appointmentId,
        submittedAt: submission.submittedAt,
        submittedBy: submission.submittedBy,
      })
    : null;
  const signingRequired = shouldRequireSignature(normalizedForm, normalizedSubmission ?? undefined);
  const status = deriveFormStatus(normalizedSubmission, signingRequired);

  return {
    form: normalizedForm,
    submission: normalizedSubmission ?? null,
    status,
    signingRequired,
    signingUrl: signingUrl ?? null,
    source,
    formVersion: formVersion ?? resolveFormVersion(form, submission ?? undefined),
    soapSection,
  };
};

const mergeEntries = (
  existing: AppointmentFormEntry[],
  incoming: AppointmentFormEntry[],
): AppointmentFormEntry[] => {
  const byKey = new Map<string, AppointmentFormEntry>();

  const upsert = (entry: AppointmentFormEntry) => {
    const submissionKey = entry.submission?._id ? `sub-${entry.submission._id}` : null;
    const pendingKey = `form-${entry.form._id}-${entry.source}`;
    const key = submissionKey ?? pendingKey;
    if (submissionKey) {
      // Drop any pending entries for the same form (any source) once a submission exists
      Array.from(byKey.entries()).forEach(([existingKey, existingVal]) => {
        if (existingVal.form._id === entry.form._id) {
          byKey.delete(existingKey);
        }
      });
    }
    if (!submissionKey) {
      const hasSubmittedForForm = Array.from(byKey.values()).some(
        existingEntry => existingEntry.form._id === entry.form._id && existingEntry.submission,
      );
      if (hasSubmittedForForm) {
        return;
      }
    }
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, entry);
      return;
    }
    byKey.set(key, {
      ...current,
      ...entry,
      submission: entry.submission ?? current.submission ?? null,
      signingUrl: entry.signingUrl ?? current.signingUrl ?? null,
      signingRequired: entry.signingRequired ?? current.signingRequired,
      status: entry.status,
      formVersion: entry.formVersion ?? current.formVersion,
      soapSection: entry.soapSection ?? current.soapSection,
    });
  };

  existing.forEach(upsert);
  incoming.forEach(upsert);

  return Array.from(byKey.values());
};

const getOrFetchForm = async (
  formId: string,
  accessToken: string,
  cache: Map<string, Form>,
): Promise<Form | null> => {
  let form = cache.get(formId);
  if (!form) {
    try {
      form = normalizeFormForState(await formApi.fetchFormById({formId, accessToken}));
      cache.set(form._id, form);
    } catch (error) {
      console.warn('[Forms] Unable to fetch form definition', formId, error);
      return null;
    }
  }
  return form;
};

const processSoapEntry = async (
  entry: SoapNoteEntry,
  section: string,
  appointmentId: string,
  accessToken: string,
  cache: Map<string, Form>,
): Promise<AppointmentFormEntry | null> => {
  if (!entry?.formId) return null;

  const form = await getOrFetchForm(entry.formId, accessToken, cache);
  if (!form) return null;

  const submission = normalizeSubmissionFromApi(
    {...entry, _id: entry.submissionId},
    form.schema,
    {
      formId: entry.formId,
      formVersion: entry.formVersion,
      appointmentId,
      submittedAt: typeof entry.submittedAt === 'string' ? new Date(entry.submittedAt) : entry.submittedAt,
      submittedBy: entry.submittedBy,
    },
  );

  return buildEntry({
    form,
    submission,
    formVersion: entry.formVersion,
    source: 'soap',
    soapSection: section,
  });
};

const collectSoapEntries = async ({
  response,
  accessToken,
  appointmentId,
  cache,
}: {
  response: SoapNotesResponse;
  accessToken: string;
  appointmentId: string;
  cache: Map<string, Form>;
}): Promise<AppointmentFormEntry[]> => {
  const results: AppointmentFormEntry[] = [];
  const groups = response.soapNotes ?? {};

  for (const [section, list] of Object.entries(groups)) {
    if (!Array.isArray(list)) continue;

    for (const entry of list) {
      const processedEntry = await processSoapEntry(entry, section, appointmentId, accessToken, cache);
      if (processedEntry) {
        results.push(processedEntry);
      }
    }
  }

  return results;
};

const fetchAppointmentFormsData = async ({
  appointmentId,
  accessToken,
  cache,
}: {
  appointmentId: string;
  accessToken: string;
  cache: Map<string, Form>;
}): Promise<AppointmentFormEntry[]> => {
  try {
    const appointmentForms = await formApi.fetchFormsForAppointment({appointmentId, accessToken});
    const entries: AppointmentFormEntry[] = [];
    appointmentForms?.items?.forEach(item => {
      const mapped = mapAppointmentFormItem(item);
      const entry = buildEntry({
        form: mapped.form,
        submission: mapped.submission,
        formVersion: mapped.formVersion,
        source: 'appointment',
      });
      entries.push(entry);
      cache.set(entry.form._id, normalizeFormForState(entry.form));
    });
    return entries;
  } catch (error) {
    console.warn('[Forms] Unable to load forms for appointment', appointmentId, error);
    return [];
  }
};

const fetchSoapFormsData = async ({
  appointmentId,
  accessToken,
  cache,
}: {
  appointmentId: string;
  accessToken: string;
  cache: Map<string, Form>;
}): Promise<AppointmentFormEntry[]> => {
  try {
    const soap = await formApi.fetchSoapNotes({appointmentId, accessToken, latestOnly: true});
    return await collectSoapEntries({response: soap, accessToken, appointmentId, cache});
  } catch (error) {
    console.warn('[Forms] Unable to load SOAP notes', appointmentId, error);
    return [];
  }
};

const fetchConsentFormIfNeeded = async ({
  forms,
  organisationId,
  serviceId,
  species,
  accessToken,
  cache,
  existingEntries,
}: {
  forms: AppointmentFormEntry[];
  organisationId?: string | null;
  serviceId?: string | null;
  species?: string | null;
  accessToken: string;
  cache: Map<string, Form>;
  existingEntries: AppointmentFormEntry[];
}): Promise<AppointmentFormEntry | null> => {
  if (forms.length || !organisationId || !serviceId) {
    return null;
  }
  try {
    const consentForm = await formApi.fetchConsentFormForService({
      organisationId,
      serviceId,
      species: species ?? undefined,
      accessToken,
    });
    const normalizedConsent = normalizeFormForState(consentForm);
    const alreadyHasForm = existingEntries.some(e => e.form._id === normalizedConsent._id);
    if (alreadyHasForm) {
      return null;
    }
    const entry = buildEntry({
      form: normalizedConsent,
      submission: null,
      source: 'service',
      formVersion: 1,
    });
    cache.set(normalizedConsent._id, normalizedConsent);
    return entry;
  } catch (error) {
    console.warn('[Forms] Unable to load consent form for service', {organisationId, serviceId}, error);
    return null;
  }
};

export const fetchAppointmentForms = createAsyncThunk<
  {appointmentId: string; forms: AppointmentFormEntry[]; cache: Record<string, Form>},
  {appointmentId: string; serviceId?: string | null; organisationId?: string | null; species?: string | null},
  {state: RootState; rejectValue: string}
>('forms/fetchAppointmentForms', async ({appointmentId, serviceId, organisationId, species}, {rejectWithValue, getState}) => {
  try {
    const {accessToken} = await ensureAccessToken();
    const existingCache = getState().forms.formsCache ?? {};
    const existingEntries = getState().forms.byAppointmentId[appointmentId] ?? [];
    const cache = new Map<string, Form>();
    Object.values(existingCache).forEach(form => {
      cache.set(form._id, form);
    });

    const forms: AppointmentFormEntry[] = [];

    const appointmentEntries = await fetchAppointmentFormsData({appointmentId, accessToken, cache});
    forms.push(...appointmentEntries);

    const soapEntries = await fetchSoapFormsData({appointmentId, accessToken, cache});
    forms.push(...soapEntries);

    const consentEntry = await fetchConsentFormIfNeeded({
      forms,
      organisationId,
      serviceId,
      species,
      accessToken,
      cache,
      existingEntries,
    });
    if (consentEntry) {
      forms.push(consentEntry);
    }

    const cacheObject = Array.from(cache.values()).reduce<Record<string, Form>>((acc, form) => {
      const normalized = normalizeFormForState(form);
      acc[normalized._id] = normalized;
      return acc;
    }, {});

    return {appointmentId, forms, cache: cacheObject};
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load forms';
    return rejectWithValue(message);
  }
});

export const submitAppointmentForm = createAsyncThunk<
  {appointmentId: string; form: Form; submission: FormSubmission},
  {
    appointmentId: string;
    form: Form;
    answers: Record<string, any>;
    formVersion?: number;
    companionId?: string | null;
  },
  {state: RootState; rejectValue: string}
>('forms/submitAppointmentForm', async (payload, {getState, rejectWithValue}) => {
  try {
    const {accessToken, userId} = await ensureAccessToken();
    const state = getState();
    const user = state.auth.user;

    const submission: FormSubmission = {
      _id: '',
      formId: payload.form._id,
      formVersion: payload.formVersion ?? resolveFormVersion(payload.form) ?? 1,
      appointmentId: payload.appointmentId,
      companionId: payload.companionId ?? undefined,
      parentId: user?.parentId ?? user?.id ?? userId,
      submittedBy: userId ?? user?.id,
      answers: payload.answers,
      submittedAt: new Date(),
    };

    const saved = await formApi.submitForm({
      formId: payload.form._id,
      submission,
      schema: payload.form.schema,
      accessToken,
    });

    return {appointmentId: payload.appointmentId, form: payload.form, submission: saved};
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to submit form';
    return rejectWithValue(message);
  }
});

export const startFormSigning = createAsyncThunk<
  {appointmentId: string; submissionId: string; signingUrl?: string | null; documentId?: string | number},
  {appointmentId: string; submissionId: string},
  {rejectValue: string}
>('forms/startFormSigning', async ({appointmentId, submissionId}, {rejectWithValue}) => {
  try {
    const {accessToken, userId} = await ensureAccessToken();
    const result = await formApi.startSigning({
      submissionId,
      accessToken,
      userId,
    });
    return {appointmentId, submissionId, signingUrl: result.signingUrl ?? null, documentId: result.documentId};
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start signing';
    return rejectWithValue(message);
  }
});

const initialState: AppointmentFormsState = {
  byAppointmentId: {},
  loadingByAppointment: {},
  submittingByForm: {},
  signingBySubmission: {},
  error: null,
  formsCache: {},
};

const EMPTY_FORMS: AppointmentFormEntry[] = [];

const formsSlice = createSlice({
  name: 'forms',
  initialState,
  reducers: {
    resetFormsState: () => initialState,
  },
  extraReducers: builder => {
    builder
      .addCase(fetchAppointmentForms.pending, (state, action) => {
        state.loadingByAppointment[action.meta.arg.appointmentId] = true;
        state.error = null;
      })
      .addCase(fetchAppointmentForms.fulfilled, (state, action) => {
        const {appointmentId, forms, cache} = action.payload;
        state.loadingByAppointment[appointmentId] = false;
        const existing = state.byAppointmentId[appointmentId] ?? [];
        state.byAppointmentId[appointmentId] = mergeEntries(existing, forms);
        state.formsCache = {...state.formsCache, ...cache};
      })
      .addCase(fetchAppointmentForms.rejected, (state, action) => {
        state.loadingByAppointment[action.meta.arg.appointmentId] = false;
        state.error = (action.payload as string) ?? action.error.message ?? null;
      })
      .addCase(submitAppointmentForm.pending, (state, action) => {
        const formId = action.meta.arg.form._id;
        state.submittingByForm[formId] = true;
        state.error = null;
      })
      .addCase(submitAppointmentForm.fulfilled, (state, action) => {
        const {appointmentId, form, submission} = action.payload;
        state.submittingByForm[form._id] = false;
        const existing = state.byAppointmentId[appointmentId] ?? [];
        const updatedEntry = buildEntry({
          form,
          submission,
          source: 'appointment',
          formVersion: submission.formVersion,
        });
        state.byAppointmentId[appointmentId] = mergeEntries(existing, [updatedEntry]);
        state.formsCache = {...state.formsCache, [form._id]: normalizeFormForState(form)};
      })
      .addCase(submitAppointmentForm.rejected, (state, action) => {
        const formId = action.meta.arg.form._id;
        state.submittingByForm[formId] = false;
        state.error = (action.payload as string) ?? action.error.message ?? null;
      })
      .addCase(startFormSigning.pending, (state, action) => {
        state.signingBySubmission[action.meta.arg.submissionId] = true;
        state.error = null;
      })
      .addCase(startFormSigning.fulfilled, (state, action) => {
        const {appointmentId, submissionId, signingUrl, documentId} = action.payload;
        state.signingBySubmission[submissionId] = false;
        const entries = state.byAppointmentId[appointmentId] ?? [];
        const updated = entries.map(entry => {
          if (entry.submission?._id !== submissionId) {
            return entry;
          }
          const signing = {
            ...(entry.submission?.signing ?? {
              required: true,
              provider: 'DOCUMENSO' as const,
              status: 'IN_PROGRESS' as const,
            }),
            status: 'IN_PROGRESS' as const,
            documentId: typeof documentId === 'number' ? String(documentId) : (documentId || entry.submission?.signing?.documentId),
          };
          const submission = entry.submission ? {...entry.submission, signing} : null;
          if (!submission) {
            return entry;
          }
          return buildEntry({
            form: entry.form,
            submission,
            source: entry.source,
            formVersion: entry.formVersion,
            signingUrl: signingUrl ?? entry.signingUrl ?? null,
          });
        });
        state.byAppointmentId[appointmentId] = updated;
      })
      .addCase(startFormSigning.rejected, (state, action) => {
        state.signingBySubmission[action.meta.arg.submissionId] = false;
        state.error = (action.payload as string) ?? action.error.message ?? null;
      });
  },
});

export const {resetFormsState} = formsSlice.actions;
export default formsSlice.reducer;

export const selectFormsForAppointment = (state: RootState, appointmentId: string) =>
  state.forms.byAppointmentId[appointmentId] ?? EMPTY_FORMS;
export const selectFormsLoading = (state: RootState, appointmentId: string) =>
  state.forms.loadingByAppointment[appointmentId] ?? false;
export const selectFormSubmitting = (state: RootState, formId: string) =>
  state.forms.submittingByForm[formId] ?? false;
export const selectSigningStatus = (state: RootState, submissionId: string) =>
  state.forms.signingBySubmission[submissionId] ?? false;
