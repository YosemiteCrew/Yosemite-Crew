import { getData, postData, putData } from '@/app/services/axios';
import { logger } from '@/app/lib/logger';
import { useOrgStore } from '@/app/stores/orgStore';

const UUID_PATH_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Mirrors the backend PatientAllergy enums (packages/database/prisma/schema.prisma).
export type AllergyType = 'DRUG' | 'FOOD' | 'ENVIRONMENTAL' | 'OTHER';
export type AllergySeverity = 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING';
export type AllergyStatus = 'ACTIVE' | 'RESOLVED' | 'UNCONFIRMED';

/**
 * A patient allergy as returned by the backend. Dates arrive as ISO strings
 * over the wire (Prisma `DateTime` serialised to JSON), so they are typed as
 * `string`, not `Date`. Nullable columns arrive as `null`.
 */
export type PatientAllergy = {
  id: string;
  organisationId: string;
  patientId: string;
  allergen: string;
  allergyType: AllergyType;
  severity: AllergySeverity;
  reaction: string | null;
  status: AllergyStatus;
  onsetDate: string | null;
  resolvedDate: string | null;
  notes: string | null;
  recordedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatePatientAllergyInput = {
  patientId: string;
  allergen: string;
  allergyType: AllergyType;
  severity: AllergySeverity;
  reaction?: string;
  status?: AllergyStatus;
  /** ISO 8601 datetime string; the backend validates with `z.iso.datetime()`. */
  onsetDate?: string;
  notes?: string;
};

export type UpdatePatientAllergyInput = {
  allergen?: string;
  allergyType?: AllergyType;
  severity?: AllergySeverity;
  reaction?: string;
  status?: AllergyStatus;
  onsetDate?: string;
  resolvedDate?: string;
  notes?: string;
};

const requireOrgId = (): string => {
  const orgId = useOrgStore.getState().primaryOrgId;
  if (!orgId) throw new Error('No active organisation selected.');
  if (!UUID_PATH_SEGMENT.test(orgId)) throw new Error('Organisation ID must be a UUID');
  return orgId;
};

export type FetchPatientAllergiesParams = {
  patientId: string;
  status?: AllergyStatus;
  allergyType?: AllergyType;
};

/**
 * GET the allergy list for a patient. The controller returns a raw array; guard
 * against a malformed body and return `[]` rather than handing a non-array to
 * the UI. The warning logs only the received `typeof`, never the payload (PII).
 */
export const fetchPatientAllergies = async ({
  patientId,
  status,
  allergyType,
}: FetchPatientAllergiesParams): Promise<PatientAllergy[]> => {
  if (!patientId) throw new Error('Patient ID missing');
  const params: Record<string, string> = { patientId };
  if (status) params.status = status;
  if (allergyType) params.allergyType = allergyType;
  const orgId = requireOrgId();
  const res = await getData<PatientAllergy[]>(
    '/v1/pms/organisation/' + orgId + '/patient-allergies',
    params
  );
  if (!Array.isArray(res.data)) {
    logger.warn('patient-allergies list was not an array; got', typeof res.data);
    return [];
  }
  return res.data;
};

/** GET a single allergy by id. The controller returns the record. */
export const fetchPatientAllergy = async (allergyId: string): Promise<PatientAllergy> => {
  const orgId = requireOrgId();
  if (!UUID_PATH_SEGMENT.test(allergyId)) throw new Error('Allergy ID must be a UUID');
  const res = await getData<PatientAllergy>(
    '/v1/pms/organisation/' + orgId + '/patient-allergies/' + allergyId
  );
  return res.data;
};

/** POST a new allergy. The controller returns the created record (201). */
export const createPatientAllergy = async (
  input: CreatePatientAllergyInput
): Promise<PatientAllergy> => {
  const orgId = requireOrgId();
  const res = await postData<PatientAllergy, CreatePatientAllergyInput>(
    '/v1/pms/organisation/' + orgId + '/patient-allergies',
    input
  );
  return res.data;
};

/** PUT a partial update. The controller returns the updated record. */
export const updatePatientAllergy = async (
  allergyId: string,
  input: UpdatePatientAllergyInput
): Promise<PatientAllergy> => {
  const orgId = requireOrgId();
  if (!UUID_PATH_SEGMENT.test(allergyId)) throw new Error('Allergy ID must be a UUID');
  const res = await putData<PatientAllergy, UpdatePatientAllergyInput>(
    '/v1/pms/organisation/' + orgId + '/patient-allergies/' + allergyId,
    input
  );
  return res.data;
};

/**
 * POST to the resolve endpoint. `resolvedDate` is optional; the backend defaults
 * it to now. The controller returns the resolved record.
 */
export const resolvePatientAllergy = async (
  allergyId: string,
  resolvedDate?: string
): Promise<PatientAllergy> => {
  const orgId = requireOrgId();
  if (!UUID_PATH_SEGMENT.test(allergyId)) throw new Error('Allergy ID must be a UUID');
  const res = await postData<PatientAllergy, { resolvedDate?: string }>(
    '/v1/pms/organisation/' + orgId + '/patient-allergies/' + allergyId + '/resolve',
    resolvedDate ? { resolvedDate } : {}
  );
  return res.data;
};
