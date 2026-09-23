import { getData, postData } from '@/app/services/axios';
import {
  PROVIDER_RECEIPT_STATUSES,
  type AllocateProviderReceiptInput,
  type ProviderReceipt,
  type ProviderReceiptAllocationFailure,
  type ProviderReceiptAllocationLine,
  type ProviderReceiptAllocationResult,
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
    allocatedAmount: toFiniteNumber(row.allocatedAmount),
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

/**
 * A refusal the allocate route answered with, as something the screen can act
 * on rather than a sentence it can only print.
 *
 * The message stays on `message` so a caller that only renders text is
 * unchanged; the code and figures ride alongside because the two useful
 * reactions - reload after a stale read, correct one line - need them. A
 * failure with no recognised body (a gateway error, a 403 from the permission
 * middleware) arrives with an empty code, which every branch below treats as
 * "not something this screen can fix".
 */
export class ProviderReceiptAllocationError extends Error {
  readonly failure: ProviderReceiptAllocationFailure;

  constructor(failure: ProviderReceiptAllocationFailure) {
    super(failure.message);
    this.name = 'ProviderReceiptAllocationError';
    this.failure = failure;
  }
}

const toOptionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const toOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined;

/**
 * The structured half of a refusal, defensively.
 *
 * Every field is optional in the reading even though the route always sends a
 * code, because the same rejection path also carries answers this screen never
 * asked for - a proxy's HTML error page, a 401 from the session middleware.
 * Reading those as "no code" is what keeps a transport failure from being
 * rendered as an allocation decision.
 */
const readAllocationFailure = (
  error: unknown,
  fallback: string
): ProviderReceiptAllocationFailure => {
  const message = getProviderReceiptErrorMessage(error, fallback);
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;
  const body = typeof data === 'object' && data !== null ? (data as { error?: unknown }) : {};
  const detail =
    typeof body.error === 'object' && body.error !== null
      ? (body.error as Record<string, unknown>)
      : {};

  return {
    code: toOptionalString(detail.code) ?? '',
    message,
    ...(toOptionalNumber(detail.version) === undefined
      ? {}
      : { version: detail.version as number }),
    ...(toOptionalNumber(detail.residual) === undefined
      ? {}
      : { residual: detail.residual as number }),
    ...(toOptionalNumber(detail.requested) === undefined
      ? {}
      : { requested: detail.requested as number }),
    ...(toOptionalString(detail.invoiceId) === undefined
      ? {}
      : { invoiceId: detail.invoiceId as string }),
  };
};

const normalizeAllocationLine = (value: unknown): ProviderReceiptAllocationLine => {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    invoiceId: typeof row.invoiceId === 'string' ? row.invoiceId : '',
    amount: toFiniteNumber(row.amount),
  };
};

const ALLOCATE_FALLBACK = 'Unable to apply this captured payment.';

/**
 * Apply a captured payment to invoices (#3170 delivery 2, from the screen).
 *
 * The response is read back rather than assumed: the receipt returned here is
 * the stored one, including the version the next decision has to be taken
 * from, and `remainingAmount` is what the server computed rather than what the
 * form subtracted. A screen that updated its row from the request would show
 * an allocation that a concurrent refund had already reduced.
 */
export const allocateProviderReceipt = async (
  organisationId: string,
  receiptId: string,
  input: AllocateProviderReceiptInput
): Promise<ProviderReceiptAllocationResult> => {
  if (!organisationId) throw new Error('Organisation ID missing');
  if (!receiptId) throw new Error('Receipt ID missing');

  let res;
  try {
    res = await postData<unknown>(
      `${receiptsPath(organisationId)}/${encodeURIComponent(receiptId)}/allocations`,
      input
    );
  } catch (error) {
    throw new ProviderReceiptAllocationError(readAllocationFailure(error, ALLOCATE_FALLBACK));
  }

  const envelope = (res.data ?? {}) as {
    data?: { receipt?: unknown; remainingAmount?: unknown; allocations?: unknown };
    meta?: { replayed?: unknown } | null;
    error?: { code?: string; message?: string } | null;
  };

  /*
   * A 200 carrying an error envelope is still a refusal. The finance
   * controllers answer failures with a status code, so this is belt and
   * braces - but a success path that trusts the status alone would report a
   * capture as applied on any response shaped like one.
   */
  if (envelope.error) {
    throw new ProviderReceiptAllocationError({
      code: envelope.error.code ?? '',
      message: envelope.error.message ?? ALLOCATE_FALLBACK,
    });
  }

  const rows = Array.isArray(envelope.data?.allocations) ? envelope.data.allocations : [];

  return {
    receipt: normalizeReceipt(envelope.data?.receipt),
    remainingAmount: toFiniteNumber(envelope.data?.remainingAmount),
    allocations: rows.map(normalizeAllocationLine),
    replayed: envelope.meta?.replayed === true,
  };
};
