import type {
  PaymentProvider as PrismaPaymentProvider,
  ProviderReceiptStatus as PrismaProviderReceiptStatus,
  Prisma,
} from "@prisma/client";
import { ProviderReceiptStatus } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  clampPageSize,
  encodeKeysetCursor,
  splitPage,
  type KeysetCursor,
  type PageSizeBounds,
} from "src/services/shared/pagination";
import logger from "src/utils/logger";

/**
 * The journal of captured provider payments (#3170).
 *
 * `Payment` and `PaymentAttempt` both require an `invoiceId`, so before this
 * existed a captured payment that could not be matched to an invoice had
 * nowhere to go: the appointment-booking webhook has five exits where the card
 * is already charged and no invoice can be minted, and every one of them wrote
 * a log line and nothing durable.
 *
 * This records the money first and attributes it afterwards. It is a JOURNAL,
 * not a ledger - writing here never posts an account credit. That belongs to
 * the canonical account receipt in #3163, which links to a row here 1:1, so a
 * second write here must never be able to mean a second credit.
 */

/**
 * The merchant account for a capture that landed on the platform account
 * rather than a connected one.
 *
 * A sentinel rather than NULL because the uniqueness of a journalled capture
 * depends on it: Postgres keeps NULLs distinct in a unique index, so a
 * nullable merchant account would let the same payment reference be journalled
 * twice - which is the one thing this table exists to prevent.
 */
export const PLATFORM_MERCHANT_ACCOUNT_REF = "PLATFORM";

export type JournalCaptureInput = {
  provider: PrismaPaymentProvider;
  /** The connected account the money landed in; platform captures pass null. */
  merchantAccountRef?: string | null;
  /** The provider's own reference for this capture - a Stripe intent id. */
  paymentRef: string;
  amount: number;
  currency: string;
  capturedAt: Date;
  organisationId?: string | null;
  invoiceId?: string | null;
  appointmentId?: string | null;
  /** Why the capture is in this state, for the human who reconciles it. */
  reason?: string | null;
  rawProviderPayload?: Prisma.InputJsonValue | null;
};

export type JournalCaptureResult = {
  id: string;
  status: PrismaProviderReceiptStatus;
  /** False when this delivery found the row a previous one had already written. */
  created: boolean;
};

const isUniqueConstraintViolation = (error: unknown): boolean =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code?: string }).code === "P2002";

/**
 * The state a freshly journalled capture starts in.
 *
 * Attribution and allocation are separate facts and this keeps them separate:
 * no organisation is UNATTRIBUTED, an organisation with nothing applied is
 * UNALLOCATED, and an invoice the ingesting path already knew about is
 * ALLOCATED. Nothing here guesses - a receipt is only ALLOCATED when the
 * caller hands over the invoice it was actually applied to.
 */
export const initialReceiptStatus = (input: {
  organisationId?: string | null;
  invoiceId?: string | null;
}): PrismaProviderReceiptStatus => {
  if (!input.organisationId) return "UNATTRIBUTED";
  return input.invoiceId ? "ALLOCATED" : "UNALLOCATED";
};

/**
 * Fill in an UNATTRIBUTED receipt once a later call knows who it belongs to.
 *
 * The identity of a receipt is immutable - provider, merchant account and
 * payment reference are the key and are never rewritten. What this fills in is
 * the context the ingesting path had not learned yet, because the journal is
 * written FIRST, before any lookup that could throw, so that no capture
 * depends on the rest of the handler succeeding.
 *
 * Deliberately narrow:
 *   - it only ever moves a receipt OUT of UNATTRIBUTED, so a receipt an
 *     operator has already acted on cannot be rewritten by a redelivery;
 *   - the status predicate is in the WHERE, not checked and then written, so a
 *     concurrent redelivery cannot both pass the check and both write;
 *   - it posts no credit anywhere. This is a journal.
 */
const attributeIfStillUnattributed = async (
  existing: { id: string; status: PrismaProviderReceiptStatus },
  input: JournalCaptureInput,
): Promise<PrismaProviderReceiptStatus> => {
  if (existing.status !== "UNATTRIBUTED" || !input.organisationId) {
    return existing.status;
  }

  const status = initialReceiptStatus(input);
  const updated = await prisma.providerReceipt.updateMany({
    where: { id: existing.id, status: "UNATTRIBUTED" },
    data: {
      organisationId: input.organisationId,
      invoiceId: input.invoiceId ?? null,
      appointmentId: input.appointmentId ?? null,
      reason: input.reason ?? null,
      status,
      version: { increment: 1 },
    },
  });

  if (updated.count === 1) return status;

  // count 0 means the row left UNATTRIBUTED between the read and the write, so
  // neither the status we intended nor the one we read is the stored one. The
  // caller is told what a receipt IS, never what a lost race hoped it would be,
  // so the only honest answer is a fresh read.
  const persisted = await prisma.providerReceipt.findUnique({
    where: { id: existing.id },
    select: { status: true },
  });
  return persisted?.status ?? existing.status;
};

/**
 * Every state a receipt can be filtered by, taken from the model rather than
 * retyped.
 *
 * Derived so that a state added to the schema cannot be silently missing from
 * the filter: a hand-written list would keep validating and quietly reject the
 * new state as unknown, which reads to an operator as "there are none".
 */
export const RECONCILIATION_STATUSES = Object.values(ProviderReceiptStatus) as [
  PrismaProviderReceiptStatus,
  ...PrismaProviderReceiptStatus[],
];

/**
 * How many receipts one page of the reconciliation queue holds (#3170).
 *
 * The issue names 50. It is both the default and the ceiling: an operator
 * reads this queue a page at a time and no caller has a reason to ask for
 * more. Clamping rather than rejecting means a client asking for 1000 gets a
 * bounded page and a cursor instead of a 400 it has to learn to avoid.
 */
export const RECONCILIATION_PAGE_SIZE: PageSizeBounds = {
  defaultSize: 50,
  maxSize: 50,
};

/**
 * The fields of a receipt the reconciliation queue returns.
 *
 * `rawProviderPayload` is deliberately absent. It is the provider's whole
 * object - billing name, email and address among them - kept so a human can
 * investigate one receipt, and a list endpoint returning it would put that on
 * the wire for every row of every page. The queue needs the money, the state
 * and the links; none of it needs the payload.
 */
const RECONCILIATION_FIELDS = {
  id: true,
  provider: true,
  merchantAccountRef: true,
  paymentRef: true,
  organisationId: true,
  invoiceId: true,
  appointmentId: true,
  amount: true,
  currency: true,
  capturedAt: true,
  status: true,
  reason: true,
  version: true,
  createdAt: true,
} as const;

/**
 * Derived from the projection rather than written out beside it.
 *
 * A hand-written twin of the model drifts the moment a column is added or a
 * nullability changes, and it drifts silently - both halves still compile. This
 * way the response type IS the projection, so the two cannot disagree.
 */
export type ReconciliationReceipt = Prisma.ProviderReceiptGetPayload<{
  select: typeof RECONCILIATION_FIELDS;
}>;

export type ListReconciliationInput = {
  organisationId: string;
  statuses?: readonly PrismaProviderReceiptStatus[];
  capturedFrom?: Date;
  capturedTo?: Date;
  cursor?: KeysetCursor;
  limit?: unknown;
};

export type ListReconciliationResult = {
  receipts: ReconciliationReceipt[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
};

/**
 * Which receipts one organisation may see in its queue.
 *
 * Two disjoint sets, and the second is why this endpoint exists. A receipt
 * carrying this organisation's id is plainly theirs. A receipt carrying NO
 * organisation but captured into the connected merchant account THIS
 * organisation owns is also theirs - not by a guess about who paid, but
 * because the money is sitting in their account. Without that arm every
 * unattributed capture is invisible to everyone, which is the state #3170
 * exists to end.
 *
 * A platform-account capture with no organisation is in no queue. `PLATFORM`
 * is a sentinel shared by every tenant, so matching on it would show one
 * organisation another's money, and nothing in such a receipt says whose it
 * is - the issue is explicit that an unattributed receipt is never assigned by
 * guessing.
 */
const reconciliationScope = (
  organisationId: string,
  merchantAccountRef: string | null,
): Prisma.ProviderReceiptWhereInput[] => {
  const scope: Prisma.ProviderReceiptWhereInput[] = [{ organisationId }];
  if (
    merchantAccountRef &&
    merchantAccountRef !== PLATFORM_MERCHANT_ACCOUNT_REF
  ) {
    scope.push({ organisationId: null, merchantAccountRef });
  }
  return scope;
};

/**
 * The connected account this organisation is the only claimant of.
 *
 * Read here rather than taken from the caller: it decides which unattributed
 * captures are in scope, so a request-supplied value would let anyone name
 * another tenant's merchant account and read their unattributed money.
 *
 * `Organization.stripeAccountId` carries no unique constraint, so "the
 * organisation that owns this account" is an assumption about the data rather
 * than something the database enforces. Two rows sharing an account would put
 * each organisation's unattributed captures in the other's queue - the exact
 * cross-tenant read the second scope arm exists to make safe. So the claim is
 * checked rather than assumed, and an ambiguous account is dropped: those
 * receipts stay out of BOTH queues until someone resolves the duplicate, which
 * is the failure that loses nothing.
 *
 * Loud when it fires. A shared connected account is a data defect, and a queue
 * quietly missing rows is worse to debug than one that said why.
 */
const exclusiveMerchantAccount = async (
  organisationId: string,
): Promise<string | null> => {
  const organisation = await prisma.organization.findUnique({
    where: { id: organisationId },
    select: { stripeAccountId: true },
  });

  const merchantAccountRef = organisation?.stripeAccountId ?? null;
  if (!merchantAccountRef) return null;

  const claimants = await prisma.organization.count({
    where: { stripeAccountId: merchantAccountRef },
  });
  if (claimants === 1) return merchantAccountRef;

  logger.error(
    `Connected merchant account of organisation ${organisationId} is claimed by ${claimants} organisations; its unattributed captures are withheld from every reconciliation queue`,
  );
  return null;
};

/**
 * The exclusive `(createdAt, id)` comparison that continues a page.
 *
 * Written out rather than done with Prisma's `cursor` + `skip: 1`, because
 * that pair is exclusive only while the cursor row is still in the filtered
 * set: attributing or refunding a receipt moves it out of the status filter
 * the caller is paging on, and the OFFSET then eats a real row while
 * `hasMore` still says the list was complete. On a work queue, rows leaving
 * the filter mid-page is the ordinary case rather than the rare one.
 */
const afterKeysetCursor = (
  cursor: KeysetCursor,
): Prisma.ProviderReceiptWhereInput => ({
  OR: [
    { createdAt: { lt: cursor.createdAt } },
    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
  ],
});

export const ProviderReceiptService = {
  /**
   * Record a captured payment, exactly once per provider reference.
   *
   * Idempotent by the provider's reference rather than by anything derived
   * from our own records: a redelivered webhook carries the SAME reference and
   * must land on the row it already wrote, while a second legitimate charge on
   * the same appointment carries a DIFFERENT one and must get its own row. Two
   * connected accounts stay isolated because the account is part of the key.
   *
   * Create-then-recover rather than upsert, for two reasons. It answers
   * whether this delivery was the one that wrote the row, which an upsert
   * cannot. And it is the shape that is correct under a concurrent redelivery:
   * the racer that loses gets P2002 from an insert the winner had already
   * committed, so the read that follows cannot miss it.
   *
   * Never throws to its caller. A journal that can fail a webhook would turn
   * "we could not record the money" into "Stripe retries this event forever",
   * which is strictly worse than a logged failure - the capture has already
   * happened either way.
   */
  async journalCapture(
    input: JournalCaptureInput,
  ): Promise<JournalCaptureResult | null> {
    const merchantAccountRef =
      input.merchantAccountRef ?? PLATFORM_MERCHANT_ACCOUNT_REF;
    const key = {
      provider: input.provider,
      merchantAccountRef,
      paymentRef: input.paymentRef,
    };

    try {
      const created = await prisma.providerReceipt.create({
        data: {
          ...key,
          organisationId: input.organisationId ?? null,
          invoiceId: input.invoiceId ?? null,
          appointmentId: input.appointmentId ?? null,
          amount: input.amount,
          currency: input.currency,
          capturedAt: input.capturedAt,
          status: initialReceiptStatus(input),
          reason: input.reason ?? null,
          ...(input.rawProviderPayload == null
            ? {}
            : { rawProviderPayload: input.rawProviderPayload }),
        },
        select: { id: true, status: true },
      });
      return { id: created.id, status: created.status, created: true };
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) {
        // The capture stands whether or not we managed to write it down, so
        // the loud failure belongs in the log and not in the webhook's status
        // code.
        logger.error(
          `Could not journal captured payment ${input.paymentRef} on ${merchantAccountRef}`,
          error,
        );
        return null;
      }

      const existing = await prisma.providerReceipt.findUnique({
        where: { provider_merchantAccountRef_paymentRef: key },
        select: { id: true, status: true },
      });
      if (!existing) {
        // A unique violation whose row cannot then be read is not a replay. It
        // means the constraint that fired was a different one, so treating it
        // as "already journalled" would be a silent loss.
        logger.error(
          `Captured payment ${input.paymentRef} on ${merchantAccountRef} collided on a unique constraint but no journal row was found`,
        );
        return null;
      }

      const attributed = await attributeIfStillUnattributed(existing, input);
      logger.info(
        `Captured payment ${input.paymentRef} on ${merchantAccountRef} was already journalled as receipt ${existing.id}`,
      );
      return { id: existing.id, status: attributed, created: false };
    }
  },

  /**
   * The reconciliation queue for one organisation (#3170 delivery 3).
   *
   * Until this existed the journal was write-only: captures that could not be
   * matched to an invoice were recorded durably and then seen by nobody, which
   * moves the gap rather than closing it. This is the read side - the list an
   * operator works through.
   *
   * Ordered by when the receipt was journalled, newest first, because that is
   * the order a queue is worked in and it is the only field guaranteed to be
   * both stable and ours. `capturedAt` comes from the provider and can arrive
   * out of order or be recovered from a refund event long afterwards, so
   * sorting on it would shuffle rows between pages; it is a filter and a
   * column, not the sort key.
   *
   * Reads nothing it does not return and returns nothing it did not read: the
   * projection is explicit, so a field added to the model later does not
   * silently join the response.
   */
  async listForReconciliation(
    input: ListReconciliationInput,
  ): Promise<ListReconciliationResult> {
    const limit = clampPageSize(input.limit, RECONCILIATION_PAGE_SIZE);

    const merchantAccountRef = await exclusiveMerchantAccount(
      input.organisationId,
    );

    const capturedAt =
      input.capturedFrom || input.capturedTo
        ? {
            ...(input.capturedFrom ? { gte: input.capturedFrom } : {}),
            ...(input.capturedTo ? { lte: input.capturedTo } : {}),
          }
        : undefined;

    const where: Prisma.ProviderReceiptWhereInput = {
      AND: [
        {
          OR: reconciliationScope(input.organisationId, merchantAccountRef),
        },
        ...(input.statuses?.length
          ? [{ status: { in: [...input.statuses] } }]
          : []),
        ...(capturedAt ? [{ capturedAt }] : []),
        ...(input.cursor ? [afterKeysetCursor(input.cursor)] : []),
      ],
    };

    const rows = await prisma.providerReceipt.findMany({
      where,
      select: RECONCILIATION_FIELDS,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      // One more than the page, which is how `hasMore` is answered without a
      // second count query against a table that only grows.
      take: limit + 1,
    });

    const page = splitPage(rows, limit, (row) =>
      encodeKeysetCursor({ createdAt: row.createdAt, id: row.id }),
    );

    return {
      receipts: page.items,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      limit,
    };
  },
};
