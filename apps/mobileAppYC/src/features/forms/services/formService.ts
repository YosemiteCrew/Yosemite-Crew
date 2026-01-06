import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import type {Questionnaire, QuestionnaireResponse} from '@yosemite-crew/fhirtypes';
import {
  type Form,
  type FormField,
  type FormSubmission,
  fromFormRequestDTO,
  fromFormSubmissionRequestDTO,
  toFormSubmissionResponseDTO,
} from '@yosemite-crew/types';
import {normalizeSubmissionFromApi} from '../utils';

export interface AppointmentFormsApiItem {
  questionnaire: Questionnaire;
  questionnaireResponse?: QuestionnaireResponse;
  status?: string;
}

export interface AppointmentFormsApiResponse {
  appointmentId: string;
  items: AppointmentFormsApiItem[];
}

export interface SoapNoteEntry {
  submissionId: string;
  formId: string;
  formVersion: number;
  submittedBy?: string;
  submittedAt: string | Date;
  answers: Record<string, unknown>;
}

export interface SoapNotesResponse {
  appointmentId: string;
  soapNotes: {
    Subjective?: SoapNoteEntry[];
    Objective?: SoapNoteEntry[];
    Assessment?: SoapNoteEntry[];
    Plan?: SoapNoteEntry[];
    Discharge?: SoapNoteEntry[];
  };
}

const toForm = (questionnaire: Questionnaire): Form => fromFormRequestDTO(questionnaire);

export const formApi = {
  async fetchFormsForAppointment({
    appointmentId,
    accessToken,
  }: {
    appointmentId: string;
    accessToken: string;
  }): Promise<AppointmentFormsApiResponse> {
    const {data} = await apiClient.get<AppointmentFormsApiResponse>(
      `/fhir/v1/form/mobile/appointments/${appointmentId}/forms`,
      {
        headers: withAuthHeaders(accessToken),
      },
    );
    return data;
  },

  async fetchSoapNotes({
    appointmentId,
    accessToken,
    latestOnly = true,
  }: {
    appointmentId: string;
    accessToken: string;
    latestOnly?: boolean;
  }): Promise<SoapNotesResponse> {
    const {data} = await apiClient.get<SoapNotesResponse>(
      `/fhir/v1/form/mobile/appointments/${appointmentId}/soap-notes`,
      {
        params: {latestOnly},
        headers: withAuthHeaders(accessToken),
      },
    );
    return data;
  },

  async fetchConsentFormForService({
    organisationId,
    serviceId,
    species,
    accessToken,
  }: {
    organisationId: string;
    serviceId: string;
    species?: string | null;
    accessToken: string;
  }): Promise<Form> {
    const {data} = await apiClient.get<Questionnaire>(
      `/fhir/v1/form/mobile/forms/${organisationId}/${serviceId}/consent-form`,
      {
        params: species ? {species} : undefined,
        headers: withAuthHeaders(accessToken),
      },
    );
    return toForm(data);
  },

  async fetchFormById({
    formId,
    accessToken,
  }: {
    formId: string;
    accessToken?: string;
  }): Promise<Form> {
    const {data} = await apiClient.get<Questionnaire>(`/fhir/v1/form/public/${formId}`, {
      headers: accessToken ? withAuthHeaders(accessToken) : undefined,
    });
    return toForm(data);
  },

  async submitForm({
    formId,
    submission,
    schema,
    accessToken,
  }: {
    formId: string;
    submission: FormSubmission;
    schema?: FormField[];
    accessToken: string;
  }): Promise<FormSubmission> {
    const payload = toFormSubmissionResponseDTO(submission, schema);
    const {data} = await apiClient.post<any>(
      `/fhir/v1/form/mobile/forms/${formId}/submit`,
      payload,
      {
        headers: withAuthHeaders(accessToken),
      },
    );
    return normalizeSubmissionFromApi(data, schema, {
      formId,
      formVersion: submission.formVersion,
      appointmentId: submission.appointmentId,
      companionId: submission.companionId,
      parentId: submission.parentId,
      submittedBy: submission.submittedBy,
      submittedAt: submission.submittedAt,
    });
  },

  async startSigning({
    submissionId,
    accessToken,
    userId,
  }: {
    submissionId: string;
    accessToken: string;
    userId?: string | null;
  }): Promise<{documentId?: string | number; signingUrl?: string | null}> {
    const {data} = await apiClient.post<{documentId?: string | number; signingUrl?: string | null}>(
      `/fhir/v1/form/mobile/form-submissions/${submissionId}/sign`,
      {},
      {
        headers: withAuthHeaders(accessToken, userId ? {'x-user-id': userId} : undefined),
      },
    );
    return data;
  },
};

export const mapAppointmentFormItem = (
  item: AppointmentFormsApiItem,
  source: 'appointment' | 'service' | 'soap' = 'appointment',
): {form: Form; submission: FormSubmission | null; formVersion?: number} => {
  const form = toForm(item.questionnaire);
  const submission = item.questionnaireResponse
    ? fromFormSubmissionRequestDTO(item.questionnaireResponse, form.schema)
    : null;
  return {
    form,
    submission,
    formVersion: submission?.formVersion,
  };
};
