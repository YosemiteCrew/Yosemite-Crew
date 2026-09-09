import axios from 'axios';
import { getData } from '@/app/services/axios';
import { logger } from '@/app/lib/logger';
import { useOrgStore } from '@/app/stores/orgStore';

const PATH_SEGMENT = /^[A-Za-z0-9_-]+$/;

export type PocTestType =
  | 'CBC'
  | 'BLOOD_CHEMISTRY'
  | 'URINALYSIS'
  | 'FECAL_FLOAT'
  | 'CYTOLOGY'
  | 'COAGULATION'
  | 'ELECTROLYTES'
  | 'THYROID_PANEL'
  | 'CORTISOL'
  | 'GLUCOSE_CURVE'
  | 'BLOOD_GAS'
  | 'OTHER';

export type LabResultParameter = {
  name: string;
  value: number | string;
  unit?: string;
  referenceRangeLow?: number;
  referenceRangeHigh?: number;
  flag?: 'H' | 'L' | 'HH' | 'LL' | 'N';
};

export type PointOfCareLabResult = {
  id: string;
  organisationId: string;
  patientId: string;
  encounterId: string | null;
  conductedAt: string;
  conductedBy: string | null;
  testType: PocTestType;
  analyzerName: string | null;
  sampleType: string | null;
  results: LabResultParameter[];
  overallInterpretation: string | null;
  abnormalFlags: string[];
  criticalFlags: string[];
  followUpRecommended: boolean | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

const safePathSegment = (value: string, label: string): string => {
  const match = PATH_SEGMENT.exec(value)?.[0];
  if (!match) throw new Error(`${label} contains unsupported characters`);
  return match;
};

const requireOrgId = (): string => {
  const orgId = useOrgStore.getState().primaryOrgId;
  if (!orgId) throw new Error('No active organisation selected.');
  return safePathSegment(orgId, 'Organisation ID');
};

export type FetchPocLabResultsParams = {
  patientId: string;
  testType?: PocTestType;
};

export const fetchPocLabResults = async ({
  patientId,
  testType,
}: FetchPocLabResultsParams): Promise<PointOfCareLabResult[]> => {
  if (!patientId) throw new Error('Patient ID missing');
  const organisationId = requireOrgId();
  try {
    const params: Record<string, string> = { patientId };
    if (testType) params.testType = testType;
    const response = await getData<PointOfCareLabResult[]>(
      `/v1/pms/organisation/${organisationId}/poc-lab`,
      params
    );
    if (!Array.isArray(response.data)) {
      logger.warn('point-of-care lab list was not an array; got', typeof response.data);
      return [];
    }
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(
        'Failed to load point-of-care lab results:',
        error.response?.data?.message ?? error.message
      );
    } else {
      logger.error('Failed to load point-of-care lab results:', error);
    }
    throw error;
  }
};
