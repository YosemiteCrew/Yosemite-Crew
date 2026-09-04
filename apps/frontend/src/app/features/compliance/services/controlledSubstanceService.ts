import axios from 'axios';
import { getData, postData } from '@/app/services/axios';
import type {
  ControlledSubstanceLog,
  ControlledSubstanceLogFilters,
  CreateControlledSubstanceLogInput,
} from '@/app/features/compliance/types/controlledSubstance';

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
  if (!/^[A-Za-z0-9_-]+$/.test(organisationId)) throw new Error('Invalid organisation ID');
  const params: Record<string, string> = {};
  if (filters.drug) params.drug = filters.drug;
  if (filters.deaSchedule) params.deaSchedule = filters.deaSchedule;
  if (filters.fromDate) params.fromDate = filters.fromDate;
  if (filters.toDate) params.toDate = filters.toDate;
  if (filters.patientId) params.patientId = filters.patientId;
  const res = await getData<ControlledSubstanceLog[]>(
    `/v1/pms/organisation/${organisationId}/controlled-substance-logs`,
    params
  );
  // The list endpoint returns a bare array. Guard so a proxy/error page that
  // replies with an object cannot crash `.map` in the register table.
  return Array.isArray(res.data) ? res.data : [];
};

export const createControlledSubstanceLog = async (
  organisationId: string,
  payload: CreateControlledSubstanceLogInput
): Promise<ControlledSubstanceLog> => {
  if (!/^[A-Za-z0-9_-]+$/.test(organisationId)) throw new Error('Invalid organisation ID');
  const res = await postData<ControlledSubstanceLog>(
    `/v1/pms/organisation/${organisationId}/controlled-substance-logs`,
    payload
  );
  return res.data;
};
