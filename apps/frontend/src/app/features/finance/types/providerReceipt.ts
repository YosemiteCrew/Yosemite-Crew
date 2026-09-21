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
