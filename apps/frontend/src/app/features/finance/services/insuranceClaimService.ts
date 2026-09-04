import { getData, postData, putData } from '@/app/services/axios';
import type {
  CreateInsuranceClaimInput,
  InsuranceClaim,
  InsuranceClaimStatus,
  UpdateClaimStatusInput,
} from '@/app/features/finance/types/insuranceClaim';

// Encode the caller's own org id + claim id as single path segments so the
// request stays pinned to `/v1/pms/organisation/<seg>/insurance-claims/<seg>`
// even if an id ever carried a slash or dot (what the SSRF scanner checks).
const claimsPath = (organisationId: string) =>
  `/v1/pms/organisation/${encodeURIComponent(organisationId)}/insurance-claims`;

const claimPath = (organisationId: string, claimId: string) =>
  `${claimsPath(organisationId)}/${encodeURIComponent(claimId)}`;

const assertOrg = (organisationId: string) => {
  if (!organisationId) throw new Error('Organisation ID missing');
};

/**
 * Human-readable message from an insurance-claim API error.
 *
 * The clinical controllers reply `{ message: string }` on every failure - both
 * the service errors (404/409/400) and the fallback 500 - so unlike the
 * estimate endpoints there is no zod `flatten` to unpack. Falling back to the
 * axios error's own message keeps a network failure legible too.
 */
export const getClaimErrorMessage = (error: unknown, fallback: string): string => {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;
  if (typeof data === 'object' && data !== null) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallback;
};

export const listInsuranceClaims = async (
  organisationId: string,
  filters?: { patientId?: string; status?: InsuranceClaimStatus; invoiceId?: string }
): Promise<InsuranceClaim[]> => {
  assertOrg(organisationId);
  // Passed as `params` rather than a query string so the request takes part in
  // the shared GET de-duplication, which keys on both.
  const params: Record<string, string> = {};
  if (filters?.patientId) params.patientId = filters.patientId;
  if (filters?.status) params.status = filters.status;
  if (filters?.invoiceId) params.invoiceId = filters.invoiceId;
  const res = await getData<InsuranceClaim[]>(claimsPath(organisationId), params);
  // The list endpoint returns a bare array. Guard anyway: a proxy or error page
  // replying with an object would otherwise crash `.map` in the table.
  return Array.isArray(res.data) ? res.data : [];
};

export const getInsuranceClaim = async (
  organisationId: string,
  claimId: string
): Promise<InsuranceClaim> => {
  assertOrg(organisationId);
  const res = await getData<InsuranceClaim>(claimPath(organisationId, claimId));
  return res.data;
};

export const createInsuranceClaim = async (
  organisationId: string,
  input: CreateInsuranceClaimInput
): Promise<InsuranceClaim> => {
  assertOrg(organisationId);
  const res = await postData<InsuranceClaim>(claimsPath(organisationId), input);
  return res.data;
};

export const updateInsuranceClaim = async (
  organisationId: string,
  claimId: string,
  input: Partial<
    Pick<
      InsuranceClaim,
      | 'insurerName'
      | 'policyNumber'
      | 'claimNumber'
      | 'submittedAmount'
      | 'notes'
      | 'externalClaimRef'
    >
  >
): Promise<InsuranceClaim> => {
  assertOrg(organisationId);
  const res = await putData<InsuranceClaim>(claimPath(organisationId, claimId), input);
  return res.data;
};

export const submitInsuranceClaim = async (
  organisationId: string,
  claimId: string
): Promise<InsuranceClaim> => {
  assertOrg(organisationId);
  const res = await postData<InsuranceClaim>(`${claimPath(organisationId, claimId)}/submit`, {});
  return res.data;
};

export const updateInsuranceClaimStatus = async (
  organisationId: string,
  claimId: string,
  input: UpdateClaimStatusInput
): Promise<InsuranceClaim> => {
  assertOrg(organisationId);
  const res = await postData<InsuranceClaim>(`${claimPath(organisationId, claimId)}/status`, input);
  return res.data;
};

export const cancelInsuranceClaim = async (
  organisationId: string,
  claimId: string
): Promise<InsuranceClaim> => {
  assertOrg(organisationId);
  const res = await postData<InsuranceClaim>(`${claimPath(organisationId, claimId)}/cancel`, {});
  return res.data;
};
