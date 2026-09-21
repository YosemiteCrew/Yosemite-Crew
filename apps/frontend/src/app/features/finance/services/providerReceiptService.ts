import { getData } from '@/app/services/axios';
import {
  PROVIDER_RECEIPT_STATUSES,
  type ProviderReceipt,
  type ProviderReceiptFilters,
  type ProviderReceiptPage,
  type ProviderReceiptStatus,
} from '@/app/features/finance/types/providerReceipt';

const FINANCE_BASE_PATH = '/v1/finance';

/**
 * The org id is encoded as a single path segment so the request stays pinned to
 * `/v1/finance/organisation/<seg>/provider-receipts` even if an id ever carried
 * a slash or a dot - the same shape the SSRF scanner checks on the claims API.
 */
const receiptsPath = (organisationId: string) =>
  `${FINANCE_BASE_PATH}/organisation/${encodeURIComponent(organisationId)}/provider-receipts`;

const KNOWN_STATUSES: ReadonlySet<string> = new Set(PROVIDER_RECEIPT_STATUSES);

const isProviderReceiptStatus = (value: unknown): value is ProviderReceiptStatus =>
  typeof value === 'string' && KNOWN_STATUSES.has(value);

/**
 * Human-readable message from a finance API error.
 *
 * The finance controllers reply with a bare `{ message }` on failure rather than
 * the success envelope, and axios only carries "Request failed with status code
 * N" on `error.message` - so the body is what has to be read.
 */
export const getProviderReceiptErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (typeof data === 'object' && data !== null) {
      const body = data as { message?: unknown; error?: { message?: unknown } };
      const message = body.error?.message ?? body.message;
      if (typeof message === 'string' && message.trim()) return message.trim();
    }
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallback;
};

const toFiniteNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const toNullableString = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null;

const toIsoString = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * One row, defensively.
 *
 * A receipt whose `status` is not one this build knows is kept and shown as
 * UNATTRIBUTED rather than dropped: the queue exists so money is never invisible,
 * and silently filtering an unrecognised state would reintroduce exactly the gap
 * the journal closed. A state added to the backend shows up here as a row that
 * needs attention, which is the safe direction to be wrong in.
 */
const normalizeReceipt = (value: unknown): ProviderReceipt => {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    id: typeof row.id === 'string' ? row.id : '',
    provider: typeof row.provider === 'string' ? row.provider : '',
    merchantAccountRef: typeof row.merchantAccountRef === 'string' ? row.merchantAccountRef : '',
    paymentRef: typeof row.paymentRef === 'string' ? row.paymentRef : '',
    organisationId: toNullableString(row.organisationId),
    invoiceId: toNullableString(row.invoiceId),
    appointmentId: toNullableString(row.appointmentId),
    amount: toFiniteNumber(row.amount),
    currency: typeof row.currency === 'string' ? row.currency : '',
    capturedAt: toIsoString(row.capturedAt),
    status: isProviderReceiptStatus(row.status) ? row.status : 'UNATTRIBUTED',
    reason: toNullableString(row.reason),
    refundedAmount: toFiniteNumber(row.refundedAmount),
    version: toFiniteNumber(row.version),
    createdAt: toIsoString(row.createdAt),
  };
};

const toParams = (filters: ProviderReceiptFilters, cursor?: string): Record<string, string> => {
  const params: Record<string, string> = {};
  if (filters.status) params.status = filters.status;
  if (filters.capturedFrom) params.capturedFrom = filters.capturedFrom;
  if (filters.capturedTo) params.capturedTo = filters.capturedTo;
  if (cursor) params.cursor = cursor;
  return params;
};

/**
 * The reconciliation queue for one organisation.
 *
 * `hasMore` is read from the response rather than inferred from `nextCursor`
 * being present, because those are different claims and the endpoint answers
 * both. It falls back to "is there a cursor" only when the field is missing.
 */
export const listProviderReceipts = async (
  organisationId: string,
  filters: ProviderReceiptFilters = {},
  cursor?: string
): Promise<ProviderReceiptPage> => {
  if (!organisationId) throw new Error('Organisation ID missing');

  const res = await getData<unknown>(receiptsPath(organisationId), toParams(filters, cursor));
  const envelope = (res.data ?? {}) as {
    data?: unknown;
    meta?: { nextCursor?: unknown; hasMore?: unknown; limit?: unknown } | null;
    error?: { code?: string; message?: string } | null;
  };

  if (envelope.error) {
    throw new Error(
      envelope.error.message ?? envelope.error.code ?? 'Unable to load the reconciliation queue.'
    );
  }

  const rows = Array.isArray(envelope.data) ? envelope.data : [];
  const nextCursor = toNullableString(envelope.meta?.nextCursor);

  return {
    receipts: rows.map(normalizeReceipt),
    nextCursor,
    hasMore:
      typeof envelope.meta?.hasMore === 'boolean' ? envelope.meta.hasMore : nextCursor !== null,
    limit: toFiniteNumber(envelope.meta?.limit),
  };
};
