import axios from 'axios';
import { getData, postData } from '@/app/services/axios';
import type {
  ControlledSubstanceLog,
  ControlledSubstanceLogFilters,
  CreateControlledSubstanceLogInput,
} from '@/app/features/compliance/types/controlledSubstance';

/**
 * Base path for the controlled-substance-log router. It is mounted under `/v1`
 * (apps/backend/src/routers/index.ts), so the full path matches the clinical
 * `/v1/pms/organisation/:organisationId/...` family the estimates service uses.
 */
const basePath = (organisationId: string) =>
  // Encode the caller's own org id as a single path segment: it keeps the
  // request pinned to `/v1/pms/organisation/<segment>/...` even if the id ever
  // carried a slash or dot, which is what the SSRF scanner wants to see.
  `/v1/pms/organisation/${encodeURIComponent(organisationId)}/controlled-substance-logs`;

const assertOrg = (organisationId: string) => {
  if (!organisationId) throw new Error('Organisation ID missing');
};

/** Human-readable message from a controlled-substance API error. */
export const getControlledSubstanceErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: unknown } | undefined;
    if (typeof data?.message === 'string' && data.message.trim()) return data.message.trim();
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallback;
};

export const fetchControlledSubstanceLogs = async (
  organisationId: string,
  filters: ControlledSubstanceLogFilters = {}
): Promise<ControlledSubstanceLog[]> => {
  assertOrg(organisationId);
  const params: Record<string, string> = {};
  if (filters.drug) params.drug = filters.drug;
  if (filters.deaSchedule) params.deaSchedule = filters.deaSchedule;
  if (filters.fromDate) params.fromDate = filters.fromDate;
  if (filters.toDate) params.toDate = filters.toDate;
  if (filters.patientId) params.patientId = filters.patientId;
  const res = await getData<ControlledSubstanceLog[]>(basePath(organisationId), params);
  // The list endpoint returns a bare array. Guard so a proxy/error page that
  // replies with an object cannot crash `.map` in the register table.
  return Array.isArray(res.data) ? res.data : [];
};

export const createControlledSubstanceLog = async (
  organisationId: string,
  payload: CreateControlledSubstanceLogInput
): Promise<ControlledSubstanceLog> => {
  assertOrg(organisationId);
  const res = await postData<ControlledSubstanceLog>(basePath(organisationId), payload);
  return res.data;
};
