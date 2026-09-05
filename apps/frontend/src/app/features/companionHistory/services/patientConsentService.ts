import axios from 'axios';
import { getData, postData } from '@/app/services/axios';
import { logger } from '@/app/lib/logger';
import { useOrgStore } from '@/app/stores/orgStore';

// A route id only ever holds a bounded id charset (UUIDs and legacy ObjectIds).
// Validating against it before the value becomes a path segment keeps a caller
// from steering the request at another path (SSRF). `exec(...)?.[0]` returns the
// matched value so the URL is built from the validated local, not the raw input.
const PATH_SEGMENT = /^[A-Za-z0-9_-]+$/;

// Mirrors the backend PatientConsent enums (packages/database/prisma/schema.prisma).
export type ConsentType =
  'SURGICAL' | 'ANESTHESIA' | 'DIAGNOSTIC' | 'TREATMENT' | 'DATA_SHARING' | 'DNR' | 'OTHER';
export type ConsentStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

/**
 * A patient consent as returned by the backend. Dates arrive as ISO strings over
 * the wire (Prisma `DateTime` serialised to JSON), so they are typed as `string`,
 * not `Date`. Nullable columns arrive as `null`.
 */
export type PatientConsent = {
  id: string;
  organisationId: string;
  patientId: string;
  consentType: ConsentType;
  status: ConsentStatus;
  procedureDesc: string | null;
  consentedByName: string | null;
  consentedAt: string;
  expiresAt: string | null;
  witnessedBy: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  documentId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * The grant payload. `consentedBy` is intentionally absent — the backend derives
 * the acting user from the session rather than trusting the client.
 */
export type CreatePatientConsentInput = {
  patientId: string;
  consentType: ConsentType;
  procedureDesc?: string;
  consentedByName?: string;
  /** ISO 8601 datetime string; the backend validates with `z.iso.datetime()`. */
  consentedAt?: string;
  expiresAt?: string;
  witnessedBy?: string;
  documentId?: string;
  notes?: string;
};

export type FetchPatientConsentsParams = {
  patientId: string;
  status?: ConsentStatus;
  consentType?: ConsentType;
};

/** Validates a value before it becomes a path segment; returns the matched local. */
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

/**
 * Runs a request and logs a failure without leaking the response body. An Axios
 * error is logged by its server message (or its own message when the request
 * never reached the server); anything else is logged as-is. The error always
 * rethrows so callers keep their existing handling.
 */
const requestWithLog = <T>(message: string, request: () => Promise<T>): Promise<T> =>
  request().catch((error: unknown) => {
    if (axios.isAxiosError(error)) {
      logger.error(message, error.response?.data?.message ?? error.message);
    } else {
      logger.error(message, error);
    }
    throw error;
  });

/**
 * GET the consent list for a patient. The controller returns a raw array; guard
 * against a malformed body by returning an empty list rather than surfacing a
 * broken shape. The warning logs only the received `typeof`, never the payload.
 */
export const fetchPatientConsents = async ({
  patientId,
  status,
  consentType,
}: FetchPatientConsentsParams): Promise<PatientConsent[]> => {
  if (!patientId) throw new Error('Patient ID missing');
  const safeOrganisationId = requireOrgId();
  return requestWithLog('Failed to load patient consents:', async () => {
    const params: Record<string, string> = { patientId };
    if (status) params.status = status;
    if (consentType) params.consentType = consentType;
    const res = await getData<PatientConsent[]>(
      `/v1/pms/organisation/${safeOrganisationId}/patient-consents`,
      params
    );
    if (!Array.isArray(res.data)) {
      logger.warn('patient-consents list was not an array; got', typeof res.data);
      return [];
    }
    return res.data;
  });
};

/** GET a single consent by id. The controller returns the record. */
export const fetchPatientConsent = async (consentId: string): Promise<PatientConsent> => {
  const safeOrganisationId = requireOrgId();
  const safeConsentId = safePathSegment(consentId, 'Consent ID');
  return requestWithLog('Failed to load patient consent:', async () => {
    const res = await getData<PatientConsent>(
      `/v1/pms/organisation/${safeOrganisationId}/patient-consents/${safeConsentId}`
    );
    return res.data;
  });
};

/** POST a new consent grant. The controller returns the created record (201). */
export const grantPatientConsent = async (
  input: CreatePatientConsentInput
): Promise<PatientConsent> => {
  const safeOrganisationId = requireOrgId();
  return requestWithLog('Failed to grant patient consent:', async () => {
    const res = await postData<PatientConsent, CreatePatientConsentInput>(
      `/v1/pms/organisation/${safeOrganisationId}/patient-consents`,
      input
    );
    return res.data;
  });
};

/**
 * POST to the revoke endpoint. `revokedReason` is optional; the body defaults to
 * an empty object when it is absent. The controller returns the revoked record.
 */
export const revokePatientConsent = async (
  consentId: string,
  revokedReason?: string
): Promise<PatientConsent> => {
  const safeOrganisationId = requireOrgId();
  const safeConsentId = safePathSegment(consentId, 'Consent ID');
  return requestWithLog('Failed to revoke patient consent:', async () => {
    const res = await postData<PatientConsent, { revokedReason?: string }>(
      `/v1/pms/organisation/${safeOrganisationId}/patient-consents/${safeConsentId}/revoke`,
      revokedReason ? { revokedReason } : {}
    );
    return res.data;
  });
};
