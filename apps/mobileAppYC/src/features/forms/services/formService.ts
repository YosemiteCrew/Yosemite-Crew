import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import type {
  Questionnaire,
  QuestionnaireResponse,
} from '@yosemite-crew/fhirtypes';
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

const toForm = (questionnaire: Questionnaire): Form =>
  fromFormRequestDTO(questionnaire);

export const formApi = {
  async fetchFormsForAppointment({
    appointmentId,
    serviceId,
    species,
    accessToken,
  }: {
    appointmentId: string;
    serviceId?: string | null;
    species?: string | null;
    accessToken: string;
  }): Promise<AppointmentFormsApiResponse> {
    const payload: Record<string, unknown> = {isPMS: false};
    if (serviceId) {
      payload.serviceId = serviceId;
    }
    if (species) {
      payload.species = species;
    }

    try {
      const {data} = await apiClient.post<AppointmentFormsApiResponse>(
        `/fhir/v1/form/mobile/appointments/${appointmentId}/forms`,
        payload,
        {
          headers: withAuthHeaders(accessToken),
        },
      );
      return data;
    } catch (mobileError: any) {
      if (mobileError?.response?.status !== 404) {
        throw mobileError;
      }

      const {data} = await apiClient.post<AppointmentFormsApiResponse>(
        `/fhir/v1/form/appointments/${appointmentId}/forms`,
        payload,
        {
          headers: withAuthHeaders(accessToken),
        },
      );
      return data;
    }
  },

  async fetchFormById({
    formId,
    accessToken,
  }: {
    formId: string;
    accessToken?: string;
  }): Promise<Form> {
    const {data} = await apiClient.get<Questionnaire>(
      `/fhir/v1/form/public/${formId}`,
      {
        headers: accessToken ? withAuthHeaders(accessToken) : undefined,
      },
    );
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
    const {data} = await apiClient.post<{
      documentId?: string | number;
      signingUrl?: string | null;
    }>(
      `/fhir/v1/form/mobile/form-submissions/${submissionId}/sign`,
      {},
      {
        headers: withAuthHeaders(
          accessToken,
          userId ? {'x-user-id': userId} : undefined,
        ),
      },
    );
    return data;
  },
};

export const mapAppointmentFormItem = (
  item: AppointmentFormsApiItem,
): {form: Form; submission: FormSubmission | null; formVersion?: number} => {
  const form = toForm(item.questionnaire);
  const submission = item.questionnaireResponse
    ? fromFormSubmissionRequestDTO(item.questionnaireResponse, form.schema)
    : null;
  const normalizedStatus = String(item.status ?? '').toUpperCase();
  const normalizedSubmission =
    submission && normalizedStatus === 'COMPLETED' && submission.signing
      ? {
          ...submission,
          signing: {
            ...submission.signing,
            status: 'SIGNED' as const,
          },
        }
      : submission;
  return {
    form,
    submission: normalizedSubmission,
    formVersion: normalizedSubmission?.formVersion,
  };
};
