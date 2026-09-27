import { getData, postData } from '@/app/services/axios';
import { linkAppointmentForms } from '@/app/features/forms/services/appointmentFormsService';
import type {
  FormAssignmentListFilters,
  FormAssignmentListItem,
} from '@/app/features/forms/types/forms';

export type FormAssignmentDTO = Record<string, unknown>;
export type CreateFormAssignmentBody = Record<string, unknown>;

export const createAppointmentFormAssignment = async (
  organisationId: string,
  appointmentId: string,
  body: CreateFormAssignmentBody
) => {
  const res = await postData<FormAssignmentDTO>(
    `/v1/forms/organisations/${organisationId}/appointments/${appointmentId}/assignments`,
    body
  );
  return res.data;
};

/**
 * Sends a form to the pet parent on an appointment: a template as a request to
 * fill it in and sign it, a form as a link on the appointment. For a template,
 * the request as it stands, which is the one already open when there is one.
 */
export const sendFormToParent = async (
  organisationId: string,
  appointmentId: string,
  form: { id: string; templateId?: string; isTemplateBacked?: boolean }
): Promise<FormAssignmentDTO | undefined> => {
  if (form.isTemplateBacked) {
    return createAppointmentFormAssignment(organisationId, appointmentId, {
      templateId: form.templateId ?? form.id,
    });
  }
  await linkAppointmentForms({ organisationId, appointmentId, formIds: [form.id] });
  return undefined;
};

export const listAppointmentFormAssignments = async (
  organisationId: string,
  appointmentId: string
) => {
  const res = await getData<FormAssignmentDTO[]>(
    `/v1/forms/organisations/${organisationId}/appointments/${appointmentId}/assignments`
  );
  return res.data ?? [];
};

/**
 * List every form assignment for an organisation (parent-assigned forms shown on
 * the /forms page). Optional filters narrow by parent, companion, or lifecycle
 * status; `status` is sent as the backend's comma-separated uppercase param.
 */
export const listOrganisationFormAssignments = async (
  organisationId: string,
  filters: FormAssignmentListFilters = {}
): Promise<FormAssignmentListItem[]> => {
  const params: Record<string, string> = {};
  if (filters.parentId) params.parentId = filters.parentId;
  if (filters.companionId) params.companionId = filters.companionId;
  if (filters.status?.length) params.status = filters.status.join(',');

  const res = await getData<FormAssignmentListItem[]>(
    `/v1/forms/organisations/${organisationId}/assignments`,
    params
  );
  return res.data ?? [];
};

export const listCompanionFormAssignments = async (organisationId: string, companionId: string) => {
  const res = await getData<FormAssignmentDTO[]>(
    `/v1/forms/organisations/${organisationId}/companions/${companionId}/assignments`
  );
  return res.data ?? [];
};

export const resendFormAssignment = async (organisationId: string, assignmentId: string) => {
  const res = await postData<FormAssignmentDTO>(
    `/v1/forms/organisations/${organisationId}/assignments/${assignmentId}/$resend`
  );
  return res.data;
};

export const cancelFormAssignment = async (organisationId: string, assignmentId: string) => {
  const res = await postData<FormAssignmentDTO>(
    `/v1/forms/organisations/${organisationId}/assignments/${assignmentId}/$cancel`
  );
  return res.data;
};
