import type {
  PaymentProvider as PrismaPaymentProvider,
  PaymentStatus as PrismaPaymentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "src/config/prisma";
import { reconciliationScopeForOrganisation } from "src/services/finance/provider-receipt";
import {
  clampPageSize,
  encodeKeysetCursor,
  splitPage,
  type KeysetCursor,
  type PageSizeBounds,
} from "src/services/shared/pagination";

/**
 * The historical mismatch audit for the provider receipt journal (#3170
 * delivery 4).
 *
 * The journal only holds what was captured after it was deployed. Everything
 * charged before that is recorded solely as a `Payment`, and a `Payment` is a
 * record of what WE applied to an invoice - not of what the provider says it
 * took. The two can disagree, and until now nothing looked.
 *
 * This looks, and does nothing else. The issue is explicit that the audit
 * performs no automatic guessed repair, so every function here reads: there is
 * no write path in this module, and a mismatch is reported to a human rather
 * than reconciled by a rule about which side is likely right. A wrong
 * automatic repair on a financial record is not recoverable by rerunning the
 * audit.
 *
 * It is deliberately one axis - settled provider payment against journal row -
 * rather than a general integrity sweep. Journal rows with no invoice are
 * already the reconciliation queue's subject (delivery 3); reporting them here
 * too would give the same rows two surfaces that can disagree about them.
 */

/**
 * What the audit found wrong about one settled payment.
 *
 * Exactly one applies to a payment - the classification is a single decision
 * with one outcome, which is what makes `examined` minus the mismatch count a
 * true matched count rather than an estimate.
 */
export type HistoricalMismatchKind =
  /** The provider captured it and no journal row of this organisation's carries the reference. */
  | "NOT_JOURNALLED"
  /** Taken through a provider, yet we kept no provider reference, so it can never be matched to one. */
  | "REFERENCE_MISSING"
  /** More than one journal row carries the reference, so which one this payment is cannot be decided. */
  | "AMBIGUOUS_JOURNAL_MATCH"
  /** The journal and the payment state different currencies, which makes their amounts not comparable. */
  | "CURRENCY_DIFFERS"
  /**
   * Same currency, different figure: we applied one amount and the provider
   * reports another.
   *
   * The commonest cause is not a corruption. `recordInvoicePayment` applies
   * `min(requested, balance)` and writes that figure to both `Payment.amount`
   * and the attempt's `amountCaptured`, so a capture larger than the invoice
   * balance is recorded nowhere at its real size and the excess is unaccounted
   * for. Read the two amounts to tell the directions apart: a journal figure
   * ABOVE the recorded one is money received and not allocated, and one BELOW
   * it is the much worse case - an invoice credited with more than the
   * provider says it took.
   */
  | "AMOUNT_DIFFERS";

/**
 * The payment states in which money was actually taken.
 *
 * `REFUNDED` and `PARTIALLY_REFUNDED` are in: a capture still happened, the
 * journal still owes a row for it, and the refund is a later fact about the
 * same money rather than a reason it was never captured. `PENDING` and
 * `FAILED` never reached a capture, so a missing journal row for them is
 * correct and reporting it would bury the real findings in noise.
 */
const CAPTURED_PAYMENT_STATUSES: readonly PrismaPaymentStatus[] = [
  "SUCCEEDED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
];

/**
 * The providers whose captures the journal is supposed to hold.
 *
 * `MANUAL` is excluded because no provider capture happened: cash taken at the
 * desk has no provider reference to journal and never will, so auditing it
 * against the journal would report every one of them forever.
 */
const JOURNALLED_PROVIDERS: readonly PrismaPaymentProvider[] = ["STRIPE"];

/**
 * How many payments one audit window examines.
 *
 * Larger than the reconciliation queue's 50, and for the opposite reason. The
 * queue returns every row it reads, so its page size is how much an operator
 * can work through at once. This reads a window and returns only what is wrong
 * in it, so a page of 50 may report nothing at all and the useful unit is
 * coverage rather than rows on a screen. Still bounded: the window is one
 * indexed read plus one lookup over the references it found.
 */
export const HISTORICAL_AUDIT_PAGE_SIZE: PageSizeBounds = {
  defaultSize: 100,
  maxSize: 200,
};

export type HistoricalMismatch = {
  kind: HistoricalMismatchKind;
  paymentId: string;
  invoiceId: string;
  provider: PrismaPaymentProvider;
  status: PrismaPaymentStatus;
  /** The provider's reference as the payment records it; null is `REFERENCE_MISSING`. */
  paymentRef: string | null;
  paidAt: Date | null;
  recordedAt: Date;
  /** What we applied, in major units of `recordedCurrency`. */
  recordedAmount: number;
  recordedCurrency: string;
  /** Every journal row of this organisation's carrying the reference. */
  journalledReceiptIds: string[];
  /** The journal's figures, present only where exactly one row carries the reference. */
  journalledAmount: number | null;
  journalledCurrency: string | null;
};

export type HistoricalAuditInput = {
  organisationId: string;
  /** Inclusive lower bound on when the payment was RECORDED here. */
  recordedFrom?: Date;
  /** Inclusive upper bound on when the payment was RECORDED here. */
  recordedTo?: Date;
  cursor?: KeysetCursor;
  limit?: unknown;
};

export type HistoricalAuditResult = {
  mismatches: HistoricalMismatch[];
  /**
   * Settled provider payments compared in THIS window. Coverage of the window,
   * never a total over the organisation - a caller that stops paging has
   * audited only what it read, and the audit says so rather than implying a
   * clean bill it never earned.
   */
  examined: number;
  /** `examined` minus the mismatches, which holds exactly because each payment yields at most one. */
  matched: number;
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
};

/** The fields a finding is built from; nothing is read that is not reported. */
const AUDITED_PAYMENT_FIELDS = {
  id: true,
  invoiceId: true,
  provider: true,
  status: true,
  providerPaymentId: true,
  amount: true,
  currency: true,
  paidAt: true,
  createdAt: true,
} as const;

type AuditedPayment = Prisma.PaymentGetPayload<{
  select: typeof AUDITED_PAYMENT_FIELDS;
}>;

type JournalRow = {
  id: string;
  provider: PrismaPaymentProvider;
  paymentRef: string;
  amount: number;
  currency: string;
};

/**
 * The exclusive `(createdAt, id)` comparison that continues a window.
 *
 * Written out rather than done with Prisma's `cursor` + `skip: 1` for the same
 * reason the reconciliation queue does: `skip` is an OFFSET on the result, so
 * once the cursor row leaves the filtered set it eats a real row instead. A
 * payment refunded between two windows stays in the status filter, but one
 * moved to a state outside it does leave - and an audit that silently skipped
 * a payment would report a clean window it never read.
 */
const afterKeysetCursor = (cursor: KeysetCursor): Prisma.PaymentWhereInput => ({
  OR: [
    { createdAt: { lt: cursor.createdAt } },
    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
  ],
});

/**
 * Provider and reference together, never the reference alone.
 *
 * The journal's identity includes the provider, and a bare reference would let
 * a payment be matched against a row from a provider it was never taken
 * through - which would report a mismatch as a match, the one direction this
 * audit must not be wrong in.
 */
const journalKey = (provider: PrismaPaymentProvider, paymentRef: string) =>
  `${provider} ${paymentRef}`;

/**
 * Decide what is wrong with one payment, or that nothing is.
 *
 * Ordered so that each branch is only reached once the one above it has been
 * ruled out. Currency before amount is the load-bearing pair: two figures in
 * different currencies are NOT COMPARABLE, so reporting `AMOUNT_DIFFERS` for
 * them would state a difference that has not been measured - and calling a
 * pair that happens to share a number a match would be worse.
 *
 * Amounts compare exactly, with no epsilon. Both sides are a provider minor
 * unit divided by the same currency exponent, so equal captures produce
 * identical doubles; a tolerance here would hide the small real differences
 * this audit exists to find.
 */
const classify = (
  payment: AuditedPayment,
  journalled: JournalRow[],
): HistoricalMismatchKind | null => {
  if (!payment.providerPaymentId) return "REFERENCE_MISSING";
  if (journalled.length === 0) return "NOT_JOURNALLED";
  if (journalled.length > 1) return "AMBIGUOUS_JOURNAL_MATCH";

  const [receipt] = journalled;
  if (receipt.currency !== payment.currency) return "CURRENCY_DIFFERS";
  if (receipt.amount !== payment.amount) return "AMOUNT_DIFFERS";
  return null;
};

const toMismatch = (
  kind: HistoricalMismatchKind,
  payment: AuditedPayment,
  journalled: JournalRow[],
): HistoricalMismatch => {
  const only = journalled.length === 1 ? journalled[0] : null;
  return {
    kind,
    paymentId: payment.id,
    invoiceId: payment.invoiceId,
    provider: payment.provider,
    status: payment.status,
    paymentRef: payment.providerPaymentId,
    paidAt: payment.paidAt,
    recordedAt: payment.createdAt,
    recordedAmount: payment.amount,
    recordedCurrency: payment.currency,
    journalledReceiptIds: journalled.map((row) => row.id),
    journalledAmount: only?.amount ?? null,
    journalledCurrency: only?.currency ?? null,
  };
};

/**
 * The journal rows this organisation is allowed to be told about.
 *
 * Scoped to its own receipts plus the ones nobody has been attributed yet,
 * the same two sets the reconciliation queue works from. A reference
 * journalled ONLY under a different organisation is reported to this one as
 * `NOT_JOURNALLED` rather than matched, which is both the honest answer from
 * where this caller stands and the one that cannot leak another tenant's
 * receipt id into an audit report. Provider references are unique per account,
 * so that case is a data defect either way and the audit surfaces it rather
 * than resolving it.
 */
const journalRowsFor = async (
  organisationId: string,
  references: string[],
): Promise<Map<string, JournalRow[]>> => {
  const byReference = new Map<string, JournalRow[]>();
  if (references.length === 0) return byReference;

  const rows = await prisma.providerReceipt.findMany({
    where: {
      paymentRef: { in: references },
      OR: await reconciliationScopeForOrganisation(organisationId),
    },
    select: {
      id: true,
      provider: true,
      paymentRef: true,
      amount: true,
      currency: true,
    },
  });

  for (const row of rows) {
    const key = journalKey(row.provider, row.paymentRef);
    const existing = byReference.get(key);
    if (existing) existing.push(row);
    else byReference.set(key, [row]);
  }
  return byReference;
};

export const ProviderReceiptAuditService = {
  /**
   * Audit one window of settled provider payments against the journal.
   *
   * Ordered by when the payment was recorded, newest first, and windowed on
   * the same field. The filter and the sort key are deliberately the same
   * column: `paidAt` is what an operator would rather window on, but it is
   * nullable, so a window built from it would silently drop every settled
   * payment that has none - an audit whose gaps are invisible is worse than no
   * audit. `paidAt` is reported on every finding instead, so nothing is lost.
   *
   * Returns findings, never repairs. Nothing in this module writes.
   */
  async auditHistoricalMismatches(
    input: HistoricalAuditInput,
  ): Promise<HistoricalAuditResult> {
    const limit = clampPageSize(input.limit, HISTORICAL_AUDIT_PAGE_SIZE);

    const recordedAt =
      input.recordedFrom || input.recordedTo
        ? {
            ...(input.recordedFrom ? { gte: input.recordedFrom } : {}),
            ...(input.recordedTo ? { lte: input.recordedTo } : {}),
          }
        : undefined;

    const where: Prisma.PaymentWhereInput = {
      AND: [
        { invoice: { organisationId: input.organisationId } },
        { provider: { in: [...JOURNALLED_PROVIDERS] } },
        { status: { in: [...CAPTURED_PAYMENT_STATUSES] } },
        ...(recordedAt ? [{ createdAt: recordedAt }] : []),
        ...(input.cursor ? [afterKeysetCursor(input.cursor)] : []),
      ],
    };

    const rows = await prisma.payment.findMany({
      where,
      select: AUDITED_PAYMENT_FIELDS,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      // One more than the window, which answers `hasMore` without a second
      // count over a table that only grows.
      take: limit + 1,
    });

    const page = splitPage(rows, limit, (row) =>
      encodeKeysetCursor({ createdAt: row.createdAt, id: row.id }),
    );

    const references = page.items
      .map((payment) => payment.providerPaymentId)
      .filter((reference): reference is string => !!reference);

    const journal = await journalRowsFor(input.organisationId, references);

    const mismatches: HistoricalMismatch[] = [];
    for (const payment of page.items) {
      const journalled = payment.providerPaymentId
        ? (journal.get(
            journalKey(payment.provider, payment.providerPaymentId),
          ) ?? [])
        : [];
      const kind = classify(payment, journalled);
      if (kind) mismatches.push(toMismatch(kind, payment, journalled));
    }

    return {
      mismatches,
      examined: page.items.length,
      matched: page.items.length - mismatches.length,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      limit,
    };
  },
};
