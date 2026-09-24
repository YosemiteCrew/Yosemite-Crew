import axios from 'axios';
import { getData, postData } from '@/app/services/axios';
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

export type LabResultFlag = 'H' | 'L' | 'HH' | 'LL' | 'N';

export type LabResultParameter = {
  name: string;
  value: number | string;
  unit?: string;
  referenceRangeLow?: number;
  referenceRangeHigh?: number;
  flag?: LabResultFlag;
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

/** Logs the server's message (never the response body, which can carry patient data). */
const logRequestError = (action: string, error: unknown): void => {
  if (axios.isAxiosError(error)) {
    logger.error(action, error.response?.data?.message ?? error.message);
  } else {
    logger.error(action, error);
  }
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
    logRequestError('Failed to load point-of-care lab results:', error);
    throw error;
  }
};

/** The POST body. Optional keys are left out rather than sent empty. */
export type CreatePocLabResultInput = {
  patientId: string;
  conductedAt: string;
  testType: PocTestType;
  sampleType?: string;
  analyzerName?: string;
  results: LabResultParameter[];
  overallInterpretation?: string;
  abnormalFlags?: string[];
  criticalFlags?: string[];
  followUpRecommended?: boolean;
  notes?: string;
};

/** Records one in-house result. The controller answers with the stored record. */
export const createPocLabResult = async (
  input: CreatePocLabResultInput
): Promise<PointOfCareLabResult> => {
  if (!input.patientId) throw new Error('Patient ID missing');
  const organisationId = requireOrgId();
  try {
    const response = await postData<PointOfCareLabResult, CreatePocLabResultInput>(
      `/v1/pms/organisation/${organisationId}/poc-lab`,
      input
    );
    return response.data;
  } catch (error) {
    logRequestError('Failed to record point-of-care lab result:', error);
    throw error;
  }
};
