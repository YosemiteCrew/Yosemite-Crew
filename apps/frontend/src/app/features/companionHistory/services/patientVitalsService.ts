import axios from 'axios';
import { getData } from '@/app/services/axios';
import { logger } from '@/app/lib/logger';
import { useOrgStore } from '@/app/stores/orgStore';

const PATH_SEGMENT = /^[A-Za-z0-9_-]+$/;

export type VitalMeasurement = {
  code: string;
  value: number | string;
  unit: string | null;
};

export type VitalsHistorySource =
  | {
      type: 'VITAL_RECORD';
      id: string;
      appointmentId: string | null;
      encounterId: string | null;
      status: string;
    }
  | {
      type: 'INPATIENT_MONITORING';
      id: string;
      admissionId: string | null;
      encounterId: string | null;
    };

export type VitalsHistoryEntry = {
  measuredAt: string;
  recordedBy: string | null;
  recordedByDisplay: string | null;
  source: VitalsHistorySource;
  measurements: VitalMeasurement[];
};

export type VitalsHistory = {
  entries: VitalsHistoryEntry[];
  truncated: boolean;
};

const safePathSegment = (value: string, label: string): string => {
  const match = PATH_SEGMENT.exec(value)?.[0];
  if (!match) throw new Error(`${label} contains unsupported characters`);
  return match;
};

export const fetchPatientVitalsHistory = async (patientId: string): Promise<VitalsHistory> => {
  if (!patientId) throw new Error('Patient ID missing');
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) throw new Error('No active organisation selected.');
  const organisationId = safePathSegment(primaryOrgId, 'Organisation ID');
  const companionId = safePathSegment(patientId, 'Patient ID');
  try {
    const response = await getData<VitalsHistory>(
      `/v1/companion-history/pms/organisation/${organisationId}/companion/${companionId}/vitals`
    );
    const data = response.data;
    if (!data || !Array.isArray(data.entries)) {
      logger.warn('vitals history had no entries list; got', typeof data);
      return { entries: [], truncated: false };
    }
    return { entries: data.entries, truncated: data.truncated === true };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(
        'Failed to load vitals history:',
        error.response?.data?.message ?? error.message
      );
    } else {
      logger.error('Failed to load vitals history:', error);
    }
    throw error;
  }
};
