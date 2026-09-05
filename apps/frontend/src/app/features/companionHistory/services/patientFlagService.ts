import axios from 'axios';
import { getData, patchData, postData } from '@/app/services/axios';
import { logger } from '@/app/lib/logger';
import { useOrgStore } from '@/app/stores/orgStore';

const UUID_PATH_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PatientFlagType =
  | 'AGGRESSION'
  | 'ESCAPE_RISK'
  | 'ALLERGY_WARNING'
  | 'ANXIETY'
  | 'SPECIAL_HANDLING'
  | 'BILLING_NOTE'
  | 'VIP'
  | 'QUARANTINE'
  | 'OTHER';

export type FlagSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type PatientFlag = {
  id: string;
  organisationId: string;
  patientId: string;
  flagType: PatientFlagType;
  severity: FlagSeverity;
  title: string;
  description: string | null;
  isActive: boolean;
  createdBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatePatientFlagInput = {
  patientId: string;
  flagType: PatientFlagType;
  severity?: FlagSeverity;
  title: string;
  description?: string;
};

export type UpdatePatientFlagInput = {
  flagType?: PatientFlagType;
  severity?: FlagSeverity;
  title?: string;
  description?: string;
};

export type FetchPatientFlagsParams = {
  patientId?: string;
  flagType?: PatientFlagType;
  severity?: FlagSeverity;
  isActive?: boolean;
};

const requireOrgId = (): string => {
  const orgId = useOrgStore.getState().primaryOrgId;
  if (!orgId) throw new Error('No active organisation selected.');
  if (!UUID_PATH_SEGMENT.test(orgId)) throw new Error('Organisation ID must be a UUID');
  return orgId;
};

/** Validates a flag id before it becomes a path segment, mirroring requireOrgId. */
const requireFlagId = (flagId: string): string => {
  if (!UUID_PATH_SEGMENT.test(flagId)) throw new Error('Flag ID must be a UUID');
  return flagId;
};

const requestWithLog = <T>(message: string, request: () => Promise<T>): Promise<T> =>
  request().catch((error: unknown) => {
    if (axios.isAxiosError(error)) {
      logger.error(message, error.response?.data?.message ?? error.message);
    } else {
      logger.error(message, error);
    }
    throw error;
  });

export const fetchPatientFlags = async (
  filters: FetchPatientFlagsParams = {}
): Promise<PatientFlag[]> => {
  const orgId = requireOrgId();
  return requestWithLog('Failed to load patient flags:', async () => {
    const params: Record<string, string | boolean> = {};
    if (filters.patientId) params.patientId = filters.patientId;
    if (filters.flagType) params.flagType = filters.flagType;
    if (filters.severity) params.severity = filters.severity;
    if (filters.isActive !== undefined) params.isActive = filters.isActive;
    const response = await getData<PatientFlag[]>(
      '/v1/pms/organisation/' + orgId + '/patient-flags',
      params
    );
    if (!Array.isArray(response.data)) {
      logger.warn('patient-flags list was not an array; got', typeof response.data);
      return [];
    }
    return response.data;
  });
};

export const fetchPatientFlag = async (flagId: string): Promise<PatientFlag> => {
  const orgId = requireOrgId();
  const safeFlagId = requireFlagId(flagId);
  return requestWithLog('Failed to load patient flag:', async () => {
    const response = await getData<PatientFlag>(
      '/v1/pms/organisation/' + orgId + '/patient-flags/' + safeFlagId
    );
    return response.data;
  });
};

export const createPatientFlag = async (input: CreatePatientFlagInput): Promise<PatientFlag> => {
  const orgId = requireOrgId();
  return requestWithLog('Failed to create patient flag:', async () => {
    const response = await postData<PatientFlag, CreatePatientFlagInput>(
      '/v1/pms/organisation/' + orgId + '/patient-flags',
      input
    );
    return response.data;
  });
};

export const updatePatientFlag = async (
  flagId: string,
  input: UpdatePatientFlagInput
): Promise<PatientFlag> => {
  const orgId = requireOrgId();
  const safeFlagId = requireFlagId(flagId);
  return requestWithLog('Failed to update patient flag:', async () => {
    const response = await patchData<PatientFlag, UpdatePatientFlagInput>(
      '/v1/pms/organisation/' + orgId + '/patient-flags/' + safeFlagId,
      input
    );
    return response.data;
  });
};

export const resolvePatientFlag = async (flagId: string): Promise<PatientFlag> => {
  const orgId = requireOrgId();
  const safeFlagId = requireFlagId(flagId);
  return requestWithLog('Failed to resolve patient flag:', async () => {
    const response = await postData<PatientFlag>(
      '/v1/pms/organisation/' + orgId + '/patient-flags/' + safeFlagId + '/resolve',
      {}
    );
    return response.data;
  });
};
