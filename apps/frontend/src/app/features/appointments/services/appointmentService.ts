import {
  Appointment,
  AppointmentResponseDTO,
  fromAppointmentRequestDTO,
  toAppointmentResponseDTO,
} from '@yosemite-crew/types';

import { useOrgStore } from '@/app/stores/orgStore';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useAuthStore } from '@/app/stores/authStore';
import { useTeamStore } from '@/app/stores/teamStore';
import { getData, patchData, postData } from '@/app/services/axios';
import {
  AvailabilityResponse,
  AppointmentStatus,
  InventoryConsumeRequest,
  Slot,
} from '@/app/features/appointments/types/appointments';
import { formatDateLocal } from '@/app/lib/date';
import { fetchInventoryItems } from '@/app/features/inventory/services/inventoryService';
import {
  canTransitionAppointmentStatus,
  getInvalidAppointmentStatusTransitionMessage,
} from '@/app/lib/appointments';

type AppointmentPaymentStatus = 'PAID' | 'UNPAID' | 'PAID_CASH' | 'PAYMENT_AT_CLINIC';

const normalizeLeadId = (value?: string | null) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  const lowered = trimmed.toLowerCase();
  return lowered === 'undefined' || lowered === 'null' ? '' : trimmed;
};

const getOrgIdForAppointment = (appointment: Appointment) => {
  const { primaryOrgId } = useOrgStore.getState();
  return primaryOrgId ?? appointment.organisationId;
};

const extractAppointmentDTO = (response: any): AppointmentResponseDTO | null => {
  const candidates = [
    response?.data?.data,
    response?.data?.data?.appointment,
    response?.data?.appointment,
    response?.data,
  ];
  for (const candidate of candidates) {
    if (!candidate || Array.isArray(candidate)) continue;
    if (candidate?.resourceType === 'Appointment') {
      return candidate as AppointmentResponseDTO;
    }
    if (candidate?.id) {
      return candidate as AppointmentResponseDTO;
    }
  }

  return null;
};

const upsertFromResponse = (
  response: any,
  fallbackAppointment?: Appointment
): Appointment | undefined => {
  const { upsertAppointment } = useAppointmentStore.getState();
  const dto = extractAppointmentDTO(response);
  if (dto) {
    const appointment = fromAppointmentRequestDTO(dto);
    upsertAppointment(appointment);
    return appointment;
  }
  if (fallbackAppointment) {
    upsertAppointment(fallbackAppointment);
    return fallbackAppointment;
  }
  return undefined;
};

export const loadAppointmentsForPrimaryOrg = async (opts?: {
  silent?: boolean;
  force?: boolean;
}): Promise<void> => {
  const { startLoading, status, setAppointmentsForOrg } = useAppointmentStore.getState();
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot load appointments.');
    return;
  }
  if (!shouldFetchAppointments(status, opts)) return;
  if (!opts?.silent) startLoading();
  try {
    const res = await getData<{ data: AppointmentResponseDTO[] }>(
      '/fhir/v1/appointment/pms/organisation/' + primaryOrgId
    );
    const appointments = res.data?.data.map((dto) => fromAppointmentRequestDTO(dto));
    setAppointmentsForOrg(primaryOrgId, appointments);
  } catch (err) {
    console.error('Failed to load appointments:', err);
    throw err;
  }
};

const shouldFetchAppointments = (
  status: ReturnType<typeof useAppointmentStore.getState>['status'],
  opts?: { force?: boolean }
) => {
  if (opts?.force) return true;
  return status === 'idle' || status === 'error';
};

export const createAppointment = async (appointment: Appointment) => {
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot create appointment.');
    return;
  }
  try {
    const payload: Appointment = {
      ...appointment,
      organisationId: primaryOrgId,
    };
    const fhirAppointment = toAppointmentResponseDTO(payload);
    const res = await postData<{
      data: { appointment: AppointmentResponseDTO };
    }>('/fhir/v1/appointment/pms?createPayment=true', fhirAppointment);
    upsertFromResponse(res);
  } catch (err) {
    console.error('Failed to create appointment:', err);
    throw err;
  }
};

export const updateAppointment = async (payload: Appointment) => {
  const { primaryOrgId } = useOrgStore.getState();
  const organisationIdForRequest = primaryOrgId ?? payload.organisationId;
  if (!organisationIdForRequest) {
    console.warn('No primary organization selected. Cannot update appointment.');
    return;
  }
  if (!payload.id) {
    console.warn('updateAppointment: missing appointment.id', payload);
    return;
  }
  try {
    const fhirAppointment = toAppointmentResponseDTO({
      ...payload,
      organisationId: organisationIdForRequest,
    });
    const res = await patchData<{
      data: AppointmentResponseDTO;
    }>('/fhir/v1/appointment/pms/' + organisationIdForRequest + '/' + payload.id, fhirAppointment);
    return upsertFromResponse(res);
  } catch (err) {
    console.error('Failed to update appointment:', err);
    throw err;
  }
};

export const useAppointmentById = (id?: string) => {
  return useAppointmentStore((s) => (id ? s.appointmentsById[id] : undefined));
};

export const getSlotsForServiceAndDateForPrimaryOrg = async (
  serviceId: string,
  date: Date
): Promise<Slot[]> => {
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot load companions.');
    return [];
  }
  try {
    if (!serviceId || !date) {
      return [];
    }
    const payload = {
      serviceId: serviceId,
      organisationId: primaryOrgId,
      date: formatDateLocal(date),
    };
    const res = await postData<AvailabilityResponse>('/fhir/v1/service/bookable-slots', payload);
    const data = res.data;
    return toSlotsArray(data);
  } catch (err) {
    console.error('Failed to create service:', err);
    throw err;
  }
};

export const toSlotsArray = (res: AvailabilityResponse): Slot[] =>
  (res.data?.windows ?? []).map(({ startTime, endTime, vetIds }) => ({
    startTime,
    endTime,
    vetIds,
  }));

const performAppointmentAction = async (
  appointment: Appointment,
  action: 'accept' | 'cancel' | 'checkin' | 'reject'
) => {
  const organisationIdForRequest = getOrgIdForAppointment(appointment);
  if (!appointment.id) {
    return;
  }
  if (!organisationIdForRequest) {
    console.warn(`No organization selected. Cannot ${action} appointment.`);
    return;
  }
  try {
    let appointmentPayload = appointment;
    const shouldAutofillLead = action === 'accept' && normalizeLeadId(appointment.lead?.id) === '';
    if (shouldAutofillLead) {
      const authUserId = useAuthStore.getState().user?.getUsername?.();
      const authAttributes = useAuthStore.getState().attributes;
      const teams = useTeamStore.getState().getTeamsByOrgId(organisationIdForRequest);
      const currentMember = teams.find((member) => {
        const memberPractitionerId = normalizeLeadId(member.practionerId);
        const normalizedAuthUserId = normalizeLeadId(authUserId);
        if (normalizedAuthUserId === '') {
          return false;
        }
        return (
          memberPractitionerId === normalizedAuthUserId ||
          normalizeLeadId(member._id) === normalizedAuthUserId
        );
      });
      const fallbackLeadId = normalizeLeadId(currentMember?.practionerId);
      const fallbackLeadName =
        currentMember?.name ||
        [authAttributes?.given_name, authAttributes?.family_name]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        undefined;
      if (!fallbackLeadId) {
        throw new Error(
          'Cannot accept appointment without a valid lead. Assign/select a lead first.'
        );
      }
      appointmentPayload = {
        ...appointment,
        lead: {
          id: fallbackLeadId,
          name: fallbackLeadName ?? 'Assigned vet',
          profileUrl: appointment.lead?.profileUrl,
        },
      };
    }

    const fhirAppointment = toAppointmentResponseDTO(appointmentPayload);
    const res = await patchData<{
      data: { appointment: AppointmentResponseDTO };
    }>(
      `/fhir/v1/appointment/pms/${organisationIdForRequest}/${appointment.id}/${action}`,
      fhirAppointment
    );
    const nextStatusByAction: Partial<Record<typeof action, AppointmentStatus>> = {
      accept: 'UPCOMING',
      cancel: 'CANCELLED',
      checkin: 'CHECKED_IN',
      reject: 'CANCELLED',
    };
    return upsertFromResponse(res, {
      ...appointmentPayload,
      status: nextStatusByAction[action] ?? appointmentPayload.status,
    });
  } catch (err) {
    console.error(`Failed to ${action} appointment:`, err);
    throw err;
  }
};

export const acceptAppointment = (appointment: Appointment) =>
  performAppointmentAction(appointment, 'accept');

export const cancelAppointment = (appointment: Appointment) =>
  performAppointmentAction(appointment, 'cancel');

export const checkInAppointment = (appointment: Appointment) =>
  performAppointmentAction(appointment, 'checkin');

export const rejectAppointment = (appointment: Appointment) =>
  performAppointmentAction(appointment, 'reject');

const performStatusUpdate = async (appointment: Appointment, nextStatus: AppointmentStatus) => {
  return updateAppointment({
    ...appointment,
    status: nextStatus,
  });
};

export const changeAppointmentStatus = async (
  appointment: Appointment,
  nextStatus: AppointmentStatus
) => {
  const currentStatus = appointment.status;
  if (currentStatus === nextStatus) return appointment;
  if (!canTransitionAppointmentStatus(currentStatus, nextStatus)) {
    throw new Error(getInvalidAppointmentStatusTransitionMessage(currentStatus, nextStatus));
  }

  if (nextStatus === 'CHECKED_IN') {
    return checkInAppointment(appointment);
  }
  if (currentStatus === 'REQUESTED' && nextStatus === 'UPCOMING') {
    return acceptAppointment(appointment);
  }
  if (currentStatus === 'REQUESTED' && nextStatus === 'CANCELLED') {
    return rejectAppointment(appointment);
  }

  return performStatusUpdate(appointment, nextStatus);
};

export const updateAppointmentPaymentStatus = async (
  appointment: Appointment,
  paymentStatus: AppointmentPaymentStatus
) => {
  return updateAppointment({
    ...appointment,
    paymentStatus,
  } as Appointment);
};

export const consumeInventory = async (inventory: InventoryConsumeRequest) => {
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot consume inventory.');
    return [];
  }
  try {
    await postData('/v1/inventory/stock/consume', inventory);
    await fetchInventoryItems(primaryOrgId);
  } catch (err) {
    console.error('Failed to consume Inventory:', err);
    throw err;
  }
};

export const consumeBulkInventory = async (inventory: InventoryConsumeRequest[]) => {
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot consume inventory.');
    return [];
  }
  try {
    const body = {
      items: inventory,
    };
    await postData('/v1/inventory/stock/consume/bulk', body);
    await fetchInventoryItems(primaryOrgId);
  } catch (err) {
    console.error('Failed to consume Inventory:', err);
    throw err;
  }
};
