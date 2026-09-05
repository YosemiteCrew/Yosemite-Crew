import axios from 'axios';
import { getData, postData } from '@/app/services/axios';

/**
 * Triage priority mirrors the backend `TriagePriority` enum
 * (packages/database/prisma/schema.prisma), ordered most to least urgent:
 * IMMEDIATE, URGENT, LESS_URGENT, STANDARD, NON_URGENT.
 */
export type TriagePriority = 'IMMEDIATE' | 'URGENT' | 'LESS_URGENT' | 'STANDARD' | 'NON_URGENT';

/**
 * Check-in status mirrors the backend `CheckInStatus` enum. A WAITING patient
 * can be seen (moves to IN_CONSULTATION), marked no-show, or cancelled; an
 * IN_CONSULTATION patient can be completed or cancelled.
 */
export type CheckInStatus = 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';

/**
 * One check-in exactly as the controller returns it (the raw Prisma row). The
 * clinical handler replies with the row itself — no `{ data, meta }` envelope —
 * so `DateTime` columns arrive as ISO strings and nullable columns arrive as
 * `null`, not `undefined`.
 */
export interface PatientCheckIn {
  id: string;
  organisationId: string;
  patientId: string;
  clientId: string;
  appointmentId: string | null;
  arrivedAt: string;
  triagePriority: TriagePriority;
  triageNote: string | null;
  assignedRoomId: string | null;
  checkedInBy: string | null;
  waitStartedAt: string | null;
  seenAt: string | null;
  waitMinutes: number | null;
  status: CheckInStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The create body the controller validates. `patientId`, `clientId` and
 * `arrivedAt` (an ISO datetime string) are required; the rest are optional.
 */
export interface CreateCheckInPayload {
  patientId: string;
  clientId: string;
  appointmentId?: string;
  arrivedAt: string;
  triagePriority?: TriagePriority;
  triageNote?: string;
  checkedInBy?: string;
  notes?: string;
}

/** Optional server-side list filters (`patientId`, `status`). */
export interface CheckInListFilter {
  patientId?: string;
  status?: CheckInStatus;
}

/**
 * Path ids are interpolated straight into the request URL, so they are validated
 * against the canonical UUID shape and the matched value — not the raw input —
 * is what flows into the URL. A non-UUID id throws before any request is made,
 * which is the SSRF sanitiser the scanner recognises (`encodeURIComponent` does
 * not satisfy it, because the tainted value would still reach the URL).
 */
const assertUuid = (value: string, label: string): string => {
  const safeValue =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.exec(
      value
    )?.[0];
  if (!safeValue) throw new Error(`Invalid ${label} ID`);
  return safeValue;
};

const logFailure = (message: string, err: unknown): void => {
  if (axios.isAxiosError(err)) {
    console.error(message, err.response?.data?.message ?? err.message);
  } else {
    console.error(message, err);
  }
};

export const fetchCheckIns = async (
  organisationId: string,
  filter: CheckInListFilter = {}
): Promise<PatientCheckIn[]> => {
  const safeOrganisationId = assertUuid(organisationId, 'organisation');
  const url = `/v1/pms/organisation/${safeOrganisationId}/check-in`;
  const params: Record<string, string> = {};
  if (filter.patientId) params.patientId = filter.patientId;
  if (filter.status) params.status = filter.status;
  try {
    const res = await getData<PatientCheckIn[]>(url, params);
    if (!Array.isArray(res.data)) {
      console.warn('Check-in response is not an array; got', typeof res.data);
      return [];
    }
    return res.data;
  } catch (err) {
    logFailure('Failed to load check-ins:', err);
    throw err;
  }
};

export const fetchCheckIn = async (
  organisationId: string,
  checkInId: string
): Promise<PatientCheckIn> => {
  const safeOrganisationId = assertUuid(organisationId, 'organisation');
  const safeCheckInId = assertUuid(checkInId, 'check-in');
  const url = `/v1/pms/organisation/${safeOrganisationId}/check-in/${safeCheckInId}`;
  try {
    const res = await getData<PatientCheckIn>(url);
    return res.data;
  } catch (err) {
    logFailure('Failed to load the check-in:', err);
    throw err;
  }
};

export const createCheckIn = async (
  organisationId: string,
  payload: CreateCheckInPayload
): Promise<PatientCheckIn> => {
  const safeOrganisationId = assertUuid(organisationId, 'organisation');
  const url = `/v1/pms/organisation/${safeOrganisationId}/check-in`;
  try {
    const res = await postData<PatientCheckIn, CreateCheckInPayload>(url, payload);
    return res.data;
  } catch (err) {
    logFailure('Failed to create the check-in:', err);
    throw err;
  }
};

type CheckInTransition = 'seen' | 'complete' | 'cancel' | 'no-show';

const transition = async (
  organisationId: string,
  checkInId: string,
  action: CheckInTransition
): Promise<PatientCheckIn> => {
  const safeOrganisationId = assertUuid(organisationId, 'organisation');
  const safeCheckInId = assertUuid(checkInId, 'check-in');
  const url = `/v1/pms/organisation/${safeOrganisationId}/check-in/${safeCheckInId}/${action}`;
  try {
    const res = await postData<PatientCheckIn>(url);
    return res.data;
  } catch (err) {
    logFailure(`Failed to ${action} the check-in:`, err);
    throw err;
  }
};

export const markCheckInSeen = (organisationId: string, checkInId: string) =>
  transition(organisationId, checkInId, 'seen');

export const completeCheckIn = (organisationId: string, checkInId: string) =>
  transition(organisationId, checkInId, 'complete');

export const cancelCheckIn = (organisationId: string, checkInId: string) =>
  transition(organisationId, checkInId, 'cancel');

export const markCheckInNoShow = (organisationId: string, checkInId: string) =>
  transition(organisationId, checkInId, 'no-show');

export const assignCheckInRoom = async (
  organisationId: string,
  checkInId: string,
  roomId: string
): Promise<PatientCheckIn> => {
  const safeOrganisationId = assertUuid(organisationId, 'organisation');
  const safeCheckInId = assertUuid(checkInId, 'check-in');
  const url = `/v1/pms/organisation/${safeOrganisationId}/check-in/${safeCheckInId}/room`;
  try {
    const res = await postData<PatientCheckIn, { roomId: string }>(url, { roomId });
    return res.data;
  } catch (err) {
    logFailure('Failed to assign a room to the check-in:', err);
    throw err;
  }
};
