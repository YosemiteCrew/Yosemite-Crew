import { deleteData, getData, patchData, postData } from '@/app/services/axios';
import type {
  CreateEstimateInput,
  Estimate,
  EstimateStatus,
} from '@/app/features/finance/types/estimate';

const estimatesPath = (organisationId: string) =>
  `/v1/pms/organisation/${organisationId}/estimates`;

const stringsIn = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

/**
 * Render a zod `flatten()` as one readable sentence.
 *
 * Returns null when there is nothing to say, so the caller can fall through to
 * its own fallback rather than showing an empty string.
 */
const flattenedZodMessage = (body: unknown): string | null => {
  if (typeof body !== 'object' || body === null) return null;
  const flatten = body as { formErrors?: unknown; fieldErrors?: Record<string, unknown> };
  const fieldErrors = Object.entries(flatten.fieldErrors ?? {}).flatMap(([field, messages]) =>
    stringsIn(messages).map((message) => `${field}: ${message}`)
  );
  const all = [...stringsIn(flatten.formErrors), ...fieldErrors];
  return all.length > 0 ? all.join('. ') : null;
};

/** The error body the controller replied with, whatever shape it took. */
const errorBody = (error: unknown): unknown => {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;
  if (typeof data !== 'object' || data === null) return undefined;
  const body = data as { error?: unknown; message?: unknown };
  return body.error ?? body.message;
};

/**
 * Human-readable message from an estimate API error.
 *
 * The estimate controller does not use the finance `{ data, meta, error }`
 * envelope. It replies `{ error: string }` for service failures and
 * `{ error: <zod flatten> }` for a 400, where the flatten is
 * `{ formErrors: string[], fieldErrors: Record<string, string[]> }`. Both have
 * to be handled: rendering the flatten object directly would put "[object
 * Object]" in front of the user.
 */
export const getEstimateErrorMessage = (error: unknown, fallback: string): string => {
  const body = errorBody(error);
  if (typeof body === 'string' && body.trim()) return body.trim();

  const flattened = flattenedZodMessage(body);
  if (flattened) return flattened;

  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallback;
};

const assertOrg = (organisationId: string) => {
  if (!organisationId) throw new Error('Organisation ID missing');
};

export const listEstimates = async (
  organisationId: string,
  filters?: { patientId?: string; status?: EstimateStatus }
): Promise<Estimate[]> => {
  assertOrg(organisationId);
  // Passed as `params` rather than a hand-built query string so the request
  // takes part in the shared GET de-duplication, which keys on both.
  const params: Record<string, string> = {};
  if (filters?.patientId) params.patientId = filters.patientId;
  if (filters?.status) params.status = filters.status;
  const res = await getData<Estimate[]>(estimatesPath(organisationId), params);
  // The list endpoint returns a bare array. Guard anyway: a proxy or error page
  // that replies with an object would otherwise crash `.map` in the table.
  return Array.isArray(res.data) ? res.data : [];
};

export const getEstimate = async (
  organisationId: string,
  estimateId: string
): Promise<Estimate> => {
  assertOrg(organisationId);
  const res = await getData<Estimate>(`${estimatesPath(organisationId)}/${estimateId}`);
  return res.data;
};

export const createEstimate = async (
  organisationId: string,
  input: CreateEstimateInput
): Promise<Estimate> => {
  assertOrg(organisationId);
  const res = await postData<Estimate>(estimatesPath(organisationId), input);
  return res.data;
};

export const markEstimateSent = async (
  organisationId: string,
  estimateId: string
): Promise<Estimate> => {
  assertOrg(organisationId);
  const res = await postData<Estimate>(`${estimatesPath(organisationId)}/${estimateId}/send`, {});
  return res.data;
};

export const approveEstimate = async (
  organisationId: string,
  estimateId: string
): Promise<Estimate> => {
  assertOrg(organisationId);
  const res = await postData<Estimate>(
    `${estimatesPath(organisationId)}/${estimateId}/approve`,
    {}
  );
  return res.data;
};

export const declineEstimate = async (
  organisationId: string,
  estimateId: string,
  reason?: string
): Promise<Estimate> => {
  assertOrg(organisationId);
  const res = await postData<Estimate>(
    `${estimatesPath(organisationId)}/${estimateId}/decline`,
    reason ? { reason } : {}
  );
  return res.data;
};

/**
 * Convert an APPROVED estimate into an invoice.
 *
 * Safe to call twice: the backend claims the estimate with a conditional
 * `updateMany` inside a transaction and `Invoice.estimateId` is uniquely
 * indexed, so a second call returns the estimate already carrying the first
 * invoice's id rather than minting a second one.
 */
export const convertEstimate = async (
  organisationId: string,
  estimateId: string
): Promise<Estimate> => {
  assertOrg(organisationId);
  const res = await postData<Estimate>(
    `${estimatesPath(organisationId)}/${estimateId}/convert`,
    {}
  );
  return res.data;
};

export const updateEstimate = async (
  organisationId: string,
  estimateId: string,
  input: Partial<Pick<CreateEstimateInput, 'validUntil' | 'currency' | 'notes' | 'items'>>
): Promise<Estimate> => {
  assertOrg(organisationId);
  const res = await patchData<Estimate>(`${estimatesPath(organisationId)}/${estimateId}`, input);
  return res.data;
};

export const deleteEstimate = async (organisationId: string, estimateId: string): Promise<void> => {
  assertOrg(organisationId);
  await deleteData(`${estimatesPath(organisationId)}/${estimateId}`);
};
