import axios from 'axios';
import { getData, postData } from '@/app/services/axios';

/**
 * Waitlist status mirrors the backend `WaitlistStatus` enum
 * (packages/database/prisma/schema.prisma). WAITING entries can be offered a
 * slot; OFFERED/WAITING can be booked; anything not already CANCELLED/EXPIRED
 * can be cancelled.
 */
export type WaitlistStatus = 'WAITING' | 'OFFERED' | 'BOOKED' | 'CANCELLED' | 'EXPIRED';

/**
 * One waitlist entry exactly as the controller returns it (the Prisma
 * `entrySelect` in waitlist.service.ts). The clinical handler replies with the
 * raw row — no `{ data, meta }` envelope — so `DateTime` columns arrive as ISO
 * strings and the nullable columns arrive as `null`, not `undefined`.
 */
export interface WaitlistEntry {
  id: string;
  organisationId: string;
  patientId: string;
  requestedBy: string | null;
  preferredLeadId: string | null;
  appointmentType: string | null;
  earliestDate: string | null;
  latestDate: string | null;
  notes: string | null;
  status: WaitlistStatus;
  offeredAt: string | null;
  bookedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The add-entry body the controller validates (`AddBodySchema`). Only
 * `patientId` is required; the date fields are ISO datetime strings.
 */
export interface AddToWaitlistPayload {
  patientId: string;
  preferredLeadId?: string;
  appointmentType?: string;
  earliestDate?: string;
  latestDate?: string;
  notes?: string;
  expiresAt?: string;
}

const safePathSegment = (value: string, label: string): string => {
  const safeValue = value.match(/^[A-Za-z0-9_-]+$/)?.[0];
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

export const fetchWaitlist = async (organisationId: string): Promise<WaitlistEntry[]> => {
  const safeOrganisationId = safePathSegment(organisationId, 'organisation');
  try {
    const res = await getData<WaitlistEntry[]>(
      `/v1/pms/organisation/${safeOrganisationId}/waitlist`
    );
    if (!Array.isArray(res.data)) {
      console.warn('Waitlist response is not an array; got', typeof res.data);
      return [];
    }
    return res.data;
  } catch (err) {
    logFailure('Failed to load waitlist:', err);
    throw err;
  }
};

export const addToWaitlist = async (
  organisationId: string,
  payload: AddToWaitlistPayload
): Promise<WaitlistEntry> => {
  const safeOrganisationId = safePathSegment(organisationId, 'organisation');
  try {
    const res = await postData<WaitlistEntry, AddToWaitlistPayload>(
      `/v1/pms/organisation/${safeOrganisationId}/waitlist`,
      payload
    );
    return res.data;
  } catch (err) {
    logFailure('Failed to add waitlist entry:', err);
    throw err;
  }
};

const transition = async (
  organisationId: string,
  entryId: string,
  action: 'offer' | 'book' | 'cancel'
): Promise<WaitlistEntry> => {
  const safeOrganisationId = safePathSegment(organisationId, 'organisation');
  const safeEntryId = safePathSegment(entryId, 'waitlist entry');
  try {
    const res = await postData<WaitlistEntry>(
      `/v1/pms/organisation/${safeOrganisationId}/waitlist/${safeEntryId}/${action}`
    );
    return res.data;
  } catch (err) {
    logFailure(`Failed to ${action} waitlist entry:`, err);
    throw err;
  }
};

export const offerWaitlistEntry = (organisationId: string, entryId: string) =>
  transition(organisationId, entryId, 'offer');

export const bookWaitlistEntry = (organisationId: string, entryId: string) =>
  transition(organisationId, entryId, 'book');

export const cancelWaitlistEntry = (organisationId: string, entryId: string) =>
  transition(organisationId, entryId, 'cancel');
