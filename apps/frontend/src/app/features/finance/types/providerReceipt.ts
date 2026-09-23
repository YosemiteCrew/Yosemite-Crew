/**
 * The reconciliation queue's read model (#3170 delivery 3).
 *
 * These mirror the projection `GET /v1/finance/organisation/:id/provider-receipts`
 * returns - the backend derives its response type from the Prisma selection, so
 * this is the one hand-written half and it is deliberately narrow: it names only
 * what the screen renders, so a column added to the journal later does not
 * silently acquire a UI.
 */

/**
 * Ordered as an operator works the queue: the two states that need a decision
 * first, then the settled ones. The order is load-bearing - it is what the
 * filter pills render in - so it is not alphabetical and not the schema's order.
 */
export const PROVIDER_RECEIPT_STATUSES = [
  'UNATTRIBUTED',
  'UNALLOCATED',
  'PARTIALLY_REFUNDED',
  'ALLOCATED',
  'REFUNDED',
] as const;

export type ProviderReceiptStatus = (typeof PROVIDER_RECEIPT_STATUSES)[number];

export type ProviderReceipt = {
  id: string;
  provider: string;
  /** The connected merchant account the money landed in. */
  merchantAccountRef: string;
  /** The provider's own reference for the capture. Operational data. */
  paymentRef: string;
  /** Null while the capture is UNATTRIBUTED - the whole point of the journal. */
  organisationId: string | null;
  invoiceId: string | null;
  appointmentId: string | null;
  amount: number;
  currency: string;
  /** ISO 8601 instant from the provider. */
  capturedAt: string;
  status: ProviderReceiptStatus;
  /** Why the receipt is in its current state, in the words of the path that wrote it. */
  reason: string | null;
  /** Cumulative over every refund against this capture, not the delta of one event. */
  refundedAmount: number;
  /**
   * Cumulative over every allocation posted from this capture.
   *
   * Carried so the row can be read against the issue's oracle - captured equals
   * applied plus unapplied plus refunded. Without it the screen can show what
   * was captured and what came back but not what is left, which is the one
   * figure the allocate action is decided from.
   */
  allocatedAmount: number;
  version: number;
  /** ISO 8601 instant the capture was journalled. The queue's sort key. */
  createdAt: string;
};

/**
 * One page of the queue.
 *
 * `hasMore` is carried separately from `nextCursor` rather than derived from it
 * so a client can tell the end of the data from the end of a page, which is the
 * distinction a silently truncated list loses.
 */
export type ProviderReceiptPage = {
  receipts: ProviderReceipt[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
};

export type ProviderReceiptFilters = {
  /**
   * A single state, or undefined for every state. Single rather than a set
   * because the request has no array-safe serialisation through the shared
   * axios client, and a queue is worked one state at a time.
   */
  status?: ProviderReceiptStatus;
  /** ISO 8601 instant with an offset. Never a bare date. */
  capturedFrom?: string;
  /** ISO 8601 instant with an offset. Never a bare date. */
  capturedTo?: string;
};

/**
 * One line of an allocation: an invoice and what of this capture goes to it.
 *
 * Major units, matching the receipt's own amounts. Strictly positive - a zero
 * or negative line is a different operation, and the route refuses one.
 */
export type ProviderReceiptAllocationLine = {
  invoiceId: string;
  amount: number;
};

/**
 * One operator decision to apply a captured payment.
 *
 * `expectedVersion` and `idempotencyKey` are both required and neither stands
 * in for the other: the version says which state the decision was taken from,
 * so a refund or another operator landing in between loses the write, and the
 * key says which decision this is, so a retry after a timeout is recognised as
 * the same one rather than posted twice.
 */
export type AllocateProviderReceiptInput = {
  expectedVersion: number;
  idempotencyKey: string;
  allocations: ProviderReceiptAllocationLine[];
};

/**
 * What the route answers a refusal with, beside the sentence a human reads.
 *
 * Only the codes this screen acts on differently are named. `VERSION_CONFLICT`
 * carries the version that IS stored, so a client can re-read rather than
 * guess; `EXCEEDS_RESIDUAL` carries both figures so the form can say by how
 * much; `INVOICE_NOT_ELIGIBLE` names the line to correct.
 */
export type ProviderReceiptAllocationFailure = {
  code: string;
  message: string;
  version?: number;
  residual?: number;
  requested?: number;
  invoiceId?: string;
};

export type ProviderReceiptAllocationResult = {
  /** The receipt as stored after the write. The readback, not the request. */
  receipt: ProviderReceipt;
  /** What is left of the capture once these allocations are applied. */
  remainingAmount: number;
  allocations: ProviderReceiptAllocationLine[];
  /**
   * The decision had already been taken under this idempotency key. A success,
   * not a failure - answering a retry any other way teaches a client to treat
   * its own successful write as one.
   */
  replayed: boolean;
};
