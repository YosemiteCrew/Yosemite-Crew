import { getData, postData, putData } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';

// Mirrors the backend PatientProblem enums (packages/database/prisma/schema.prisma).
export type ProblemStatus = 'ACTIVE' | 'INACTIVE' | 'RESOLVED';
export type ProblemSeverity = 'MILD' | 'MODERATE' | 'SEVERE';

/**
 * A patient problem as returned by the backend. Dates arrive as ISO strings
 * over the wire (Prisma `DateTime` serialised to JSON), so they are typed as
 * `string`, not `Date`. Shape matches the controller's `problemSelect`.
 */
export type PatientProblem = {
  id: string;
  organisationId: string;
  patientId: string;
  encounterId: string | null;
  name: string;
  codeSystem: string | null;
  code: string | null;
  status: ProblemStatus;
  severity: ProblemSeverity | null;
  onsetDate: string | null;
  resolvedDate: string | null;
  notes: string | null;
  recordedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatePatientProblemInput = {
  patientId: string;
  encounterId?: string;
  name: string;
  codeSystem?: string;
  code?: string;
  severity?: ProblemSeverity;
  /** ISO 8601 datetime string; the backend validates with `z.iso.datetime()`. */
  onsetDate?: string;
  notes?: string;
};

export type UpdatePatientProblemInput = {
  name?: string;
  codeSystem?: string;
  code?: string;
  status?: ProblemStatus;
  severity?: ProblemSeverity;
  onsetDate?: string;
  resolvedDate?: string;
  notes?: string;
};

const requireOrgId = (): string => {
  const orgId = useOrgStore.getState().primaryOrgId;
  if (!orgId) throw new Error('No active organisation selected.');
  return orgId;
};

// Router mounts patient-problem.router at `/v1`, so the org-scoped collection is
// `/v1/pms/organisation/:organisationId/patient-problems`.
const collectionBase = (): string => `/v1/pms/organisation/${requireOrgId()}/patient-problems`;

export type FetchPatientProblemsParams = {
  patientId: string;
  status?: ProblemStatus;
};

/** GET the problem list for a patient. The controller returns a raw array. */
export const fetchPatientProblems = async ({
  patientId,
  status,
}: FetchPatientProblemsParams): Promise<PatientProblem[]> => {
  if (!patientId) throw new Error('Patient ID missing');
  const params: Record<string, string> = { patientId };
  if (status) params.status = status;
  const res = await getData<PatientProblem[]>(collectionBase(), params);
  return res.data;
};

/** POST a new problem. The controller returns the created record (201). */
export const createPatientProblem = async (
  input: CreatePatientProblemInput
): Promise<PatientProblem> => {
  const res = await postData<PatientProblem, CreatePatientProblemInput>(collectionBase(), input);
  return res.data;
};

/** PUT a partial update. The controller returns the updated record. */
export const updatePatientProblem = async (
  problemId: string,
  input: UpdatePatientProblemInput
): Promise<PatientProblem> => {
  const res = await putData<PatientProblem, UpdatePatientProblemInput>(
    `${collectionBase()}/${problemId}`,
    input
  );
  return res.data;
};

/**
 * POST to the resolve endpoint. `resolvedDate` is optional; the backend defaults
 * it to now. The controller returns the resolved record.
 */
export const resolvePatientProblem = async (
  problemId: string,
  resolvedDate?: string
): Promise<PatientProblem> => {
  const res = await postData<PatientProblem, { resolvedDate?: string }>(
    `${collectionBase()}/${problemId}/resolve`,
    resolvedDate ? { resolvedDate } : {}
  );
  return res.data;
};
