import type {
  PaymentProvider as PrismaPaymentProvider,
  ProviderReceiptStatus as PrismaProviderReceiptStatus,
  Prisma,
} from "@prisma/client";
import { ProviderReceiptStatus } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  FinancePaymentService,
  getInvoiceFinancialSummary,
} from "src/services/finance/payment";
import { roundMoney } from "src/services/finance/pricing";
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
 * How much of a capture a journalling path has already applied.
 *
 * Derived from the status rather than from the invoice id, so the two cannot
 * disagree: ALLOCATED is defined as applied in full, and this is the figure
 * that says so. Anything else has applied nothing yet.
 *
 * It exists because the status alone is not enough for the arithmetic. An
 * operator allocating from the reconciliation queue is allowed what the
 * capture has left - amount less refunded less allocated - and a receipt the
 * booking webhook had already settled read as fully available under that
 * subtraction while its status said the opposite. The same capture could then
 * be applied a second time, to a second invoice.
 */
export const initialAllocatedAmount = (input: {
  status: PrismaProviderReceiptStatus;
  amount: number;
}): number => (input.status === "ALLOCATED" ? input.amount : 0);

/**
 * The states that record money already given back.
 *
 * Attribution must never overwrite one. They answer what happened to the
 * capture, which is a different question from whose it was, and the second
 * answer arriving later is not a reason to forget the first.
 */
const REVERSED_STATUSES: ReadonlySet<PrismaProviderReceiptStatus> = new Set([
  "PARTIALLY_REFUNDED",
  "REFUNDED",
]);

/**
 * How many times the compare-and-set is attempted before giving up.
 *
 * Bounded rather than a spin. A lost CAS used to have one cause - another
 * delivery attributed the receipt, which leaves nothing to do - and now has a
 * second: a refund changed the status under a swap that was only ever about
 * the owner, which would silently drop an attribution this delivery was
 * holding. A refund contributes at most two status transitions
 * (PARTIALLY_REFUNDED, then REFUNDED), so a second attempt closes the ordinary
 * case, and a journal write on a webhook has no business retrying forever.
 */
const ATTRIBUTION_ATTEMPTS = 2;

/**
 * Fill in a receipt whose owner is still unknown, once a later call knows it.
 *
 * The identity of a receipt is immutable - provider, merchant account and
 * payment reference are the key and are never rewritten. What this fills in is
 * the context the ingesting path had not learned yet, because the journal is
 * written FIRST, before any lookup that could throw, so that no capture
 * depends on the rest of the handler succeeding.
 *
 * The gate is the missing ORGANISATION, not the UNATTRIBUTED status. Those
 * were the same predicate until a refund could move a receipt to
 * PARTIALLY_REFUNDED: gating on the status then meant a partially refunded
 * capture whose owner was never resolved could never be attributed at all, and
 * its residual would sit in the reconciliation queue with no organisation
 * forever. A receipt an operator has already acted on still cannot be
 * rewritten, because acting on one gives it an organisation.
 *
 * Deliberately narrow:
 *   - both halves of the state it decided from are in the WHERE - no owner,
 *     and the exact status that was read - so this is a compare-and-set and
 *     not a check followed by a write. Two concurrent redeliveries cannot both
 *     pass it, and a refund landing in between cannot have its status
 *     overwritten by a decision taken before it existed;
 *   - it posts no credit anywhere. This is a journal.
 */
const attributeIfOwnerStillUnknown = async (
  existing: {
    id: string;
    status: PrismaProviderReceiptStatus;
    organisationId: string | null;
  },
  input: JournalCaptureInput,
): Promise<PrismaProviderReceiptStatus> => {
  if (!input.organisationId) return existing.status;

  let observed: {
    status: PrismaProviderReceiptStatus;
    organisationId: string | null;
  } = existing;

  let attempts = 0;
  while (observed.organisationId === null && attempts < ATTRIBUTION_ATTEMPTS) {
    attempts += 1;

    const status = REVERSED_STATUSES.has(observed.status)
      ? observed.status
      : initialReceiptStatus(input);

    const updated = await prisma.providerReceipt.updateMany({
      where: {
        id: existing.id,
        organisationId: null,
        status: observed.status,
      },
      data: {
        organisationId: input.organisationId,
        invoiceId: input.invoiceId ?? null,
        appointmentId: input.appointmentId ?? null,
        reason: input.reason ?? null,
        status,
        // Paired with the status on every write, never only on the insert. An
        // attribution that arrives later and names the invoice the capture
        // went to has applied it just as much as one that knew at ingest.
        allocatedAmount: initialAllocatedAmount({
          status,
          amount: input.amount,
        }),
        version: { increment: 1 },
      },
    });

    if (updated.count === 1) return status;

    // count 0 means the row moved between the read and the write, so neither
    // the status we intended nor the one we read is the stored one. The caller
    // is told what a receipt IS, never what a lost race hoped it would be, so
    // the next decision is taken from a fresh read.
    const persisted = await prisma.providerReceipt.findUnique({
      where: { id: existing.id },
      select: { status: true, organisationId: true },
    });
    if (!persisted) return observed.status;
    observed = persisted;
  }

  // Someone else supplied the owner. That is the outcome, not a failure, and
  // it is the ordinary way this loop ends - warning here would invent an alarm
  // on a normal race.
  if (observed.organisationId !== null) return observed.status;

  // Still nobody's after every attempt. Loud, because this delivery knew the
  // owner and the stored receipt does not: the residual stays in the
  // reconciliation queue unattributed until another delivery or an operator
  // resolves it.
  logger.warn(
    `Receipt ${existing.id} lost the attribution race ${ATTRIBUTION_ATTEMPTS} times and is still unattributed`,
  );
  return observed.status;
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
 *
 * `refundedAmount` and `allocatedAmount` ARE here, because without them the
 * row cannot be read against the issue's oracle - captured equals applied plus
 * unapplied plus refunded. An operator looking at a PARTIALLY_REFUNDED receipt
 * needs the residual, and the status alone does not carry it.
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
  refundedAmount: true,
  allocatedAmount: true,
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
    `Connected merchant account of organisation ${organisationId.replace(/[\n\r]/g, "")} is claimed by ${claimants} organisations; its unattributed captures are withheld from every reconciliation queue`,
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

export type RecordRefundInput = {
  provider: PrismaPaymentProvider;
  /** The connected account the capture landed in; platform captures pass null. */
  merchantAccountRef?: string | null;
  /** The provider's own reference for the CAPTURE being reversed. */
  paymentRef: string;
  /**
   * What the provider says it has given back in total on this capture, not the
   * amount of one refund event.
   */
  refundedAmount: number;
  currency: string;
};

export type RecordRefundResult = {
  id: string;
  status: PrismaProviderReceiptStatus;
  refundedAmount: number;
  /** False when the stored figure already covered this refund. */
  applied: boolean;
};

/**
 * The state a receipt is in once the provider has given some of it back.
 *
 * A capture that has been refunded in full needs no allocation and no
 * reconciliation, so REFUNDED replaces whatever it was - including
 * UNATTRIBUTED, because money that has gone back needs no owner found for it.
 * A partial refund leaves a residual that still does, which is why it gets its
 * own state rather than being folded into either neighbour.
 *
 * `amount` and `refundedAmount` are both minor units divided by the same
 * currency exponent, so they compare exactly; there is no rounding slack to
 * absorb here and an epsilon would only hide a real over-refund.
 */
export const refundedReceiptStatus = (input: {
  amount: number;
  refundedAmount: number;
}): PrismaProviderReceiptStatus =>
  input.refundedAmount >= input.amount ? "REFUNDED" : "PARTIALLY_REFUNDED";

export type AllocationRequest = {
  invoiceId: string;
  amount: number;
};

export type AllocateInput = {
  /** The organisation the caller is authorised for, from the session. */
  organisationId: string;
  receiptId: string;
  /** The `version` the caller read the receipt at. */
  expectedVersion: number;
  /** The caller's own key for this decision, so a retry is not a second one. */
  idempotencyKey: string;
  /** The staff member who decided, from the session and never the body. */
  actorId: string;
  allocations: readonly AllocationRequest[];
};

/** Why one requested line cannot be applied. */
export type AllocationRejection =
  | "INVOICE_NOT_FOUND"
  | "CURRENCY_MISMATCH"
  | "INVOICE_CLOSED"
  | "NO_OUTSTANDING_BALANCE"
  | "EXCEEDS_INVOICE_BALANCE"
  /** This capture is already applied to that invoice under another decision. */
  | "ALREADY_ALLOCATED";

export type AllocatedLine = {
  invoiceId: string;
  /** What was actually applied, which is not always what was asked for. */
  amount: number;
  paymentId: string | null;
};

export type AllocateResult =
  | { outcome: "NOT_FOUND" }
  /** Readable, but nobody has said whose it is - and this never guesses. */
  | { outcome: "NOT_ATTRIBUTED" }
  /** The money has gone back; there is nothing left to apply. */
  | { outcome: "FULLY_REFUNDED" }
  | { outcome: "VERSION_CONFLICT"; version: number }
  | { outcome: "ACCOUNT_MISMATCH" }
  | { outcome: "EXCEEDS_RESIDUAL"; residual: number; requested: number }
  | {
      outcome: "INVOICE_NOT_ELIGIBLE";
      invoiceId: string;
      reason: AllocationRejection;
    }
  | {
      outcome: "APPLIED" | "REPLAYED";
      receipt: ReconciliationReceipt;
      /** What is still unapplied on this capture after this call. */
      remainingAmount: number;
      allocations: AllocatedLine[];
    };

/**
 * The state a receipt is in once some of it has been applied.
 *
 * A refunded state is never overwritten, for the same reason attribution does
 * not overwrite one: what happened to the money and what has been applied are
 * different facts, and the queue has to keep showing that a refund occurred.
 *
 * Otherwise ALLOCATED means applied in full against what is left to apply -
 * the captured amount less anything already given back - so a partially
 * refunded capture whose residual is fully applied is not left sitting in the
 * queue asking an operator to place money that no longer exists.
 */
export const allocatedReceiptStatus = (input: {
  status: PrismaProviderReceiptStatus;
  amount: number;
  refundedAmount: number;
  allocatedAmount: number;
}): PrismaProviderReceiptStatus => {
  if (REVERSED_STATUSES.has(input.status)) return input.status;
  return input.allocatedAmount >=
    roundMoney(input.amount - input.refundedAmount)
    ? "ALLOCATED"
    : "UNALLOCATED";
};

/**
 * What an operator may still apply from a capture.
 *
 * Both subtractions matter and they are not the same guard. Money already
 * applied must not be applied again; money already given back was never
 * available to apply at all.
 */
export const allocatableResidual = (input: {
  amount: number;
  refundedAmount: number;
  allocatedAmount: number;
}): number =>
  roundMoney(
    Math.max(0, input.amount - input.refundedAmount - input.allocatedAmount),
  );

/**
 * The receipt this caller may allocate, or the refusal to answer with.
 *
 * A receipt belonging to another organisation is answered exactly as a receipt
 * that does not exist. Anything else turns this endpoint into a test for
 * whether a given receipt id is real in some other tenant.
 *
 * The one case that is NOT folded into "not found" is a capture with no owner
 * sitting in the connected account this organisation exclusively holds. They
 * can already see it - it is in their reconciliation queue, by the same arm
 * used here so the two cannot disagree - and telling them it does not exist
 * while showing it to them is worse than useless. They are told to attribute
 * it, which is the action that unblocks them, and this call still refuses to
 * do it for them.
 */
const resolveAllocatableReceipt = async (
  receiptId: string,
  organisationId: string,
): Promise<{ receipt: AllocationReceipt } | AllocateResult> => {
  const receipt = await prisma.providerReceipt.findUnique({
    where: { id: receiptId },
    select: ALLOCATION_FIELDS,
  });
  if (!receipt) return { outcome: "NOT_FOUND" };

  if (receipt.organisationId === organisationId) return { receipt };

  if (receipt.organisationId === null) {
    const exclusive = await exclusiveMerchantAccount(organisationId);
    if (exclusive && exclusive === receipt.merchantAccountRef) {
      return { outcome: "NOT_ATTRIBUTED" };
    }
  }

  return { outcome: "NOT_FOUND" };
};

/**
 * Why a reservation did not happen, in the caller's terms.
 *
 * Both recognised failures rolled the whole transaction back, so nothing was
 * reserved in either case and neither needs to undo anything. Anything else is
 * rethrown: a database outage must not be reported to an operator as their own
 * stale read.
 */
const refusedReservation = async (
  error: unknown,
  receipt: AllocationReceipt,
  lines: readonly AllocationRequest[],
): Promise<AllocateResult> => {
  if (error instanceof LostAllocationRace) {
    /*
     * Answered with the version that IS stored rather than the one the caller
     * sent, so the client can re-read and retry without a second round trip to
     * discover what it should have sent.
     */
    const current = await prisma.providerReceipt.findUnique({
      where: { id: receipt.id },
      select: { version: true },
    });
    return {
      outcome: "VERSION_CONFLICT",
      version: current?.version ?? receipt.version,
    };
  }

  /*
   * A collision on (receiptId, invoiceId) means this capture is already
   * allocated to that invoice under a DIFFERENT key, so it is a genuine
   * double-apply and not a retry of this one.
   */
  if (isUniqueConstraintViolation(error)) {
    const clash = await prisma.providerReceiptAllocation.findFirst({
      where: {
        receiptId: receipt.id,
        invoiceId: { in: lines.map((line) => line.invoiceId) },
      },
      select: { invoiceId: true },
    });
    return {
      outcome: "INVOICE_NOT_ELIGIBLE",
      invoiceId: clash?.invoiceId ?? "",
      reason: "ALREADY_ALLOCATED",
    };
  }

  throw error;
};

/** Thrown inside the transaction purely to roll it back; never escapes. */
class LostAllocationRace extends Error {}

/**
 * The receipt fields an allocation decision is taken from.
 *
 * Every one of them is repeated in the WHERE of the compare-and-set below, so
 * the write is conditional on the exact state the decision was taken from
 * rather than on the version alone.
 */
const ALLOCATION_FIELDS = {
  id: true,
  provider: true,
  merchantAccountRef: true,
  paymentRef: true,
  organisationId: true,
  amount: true,
  currency: true,
  capturedAt: true,
  status: true,
  refundedAmount: true,
  allocatedAmount: true,
  version: true,
} as const;

type AllocationReceipt = Prisma.ProviderReceiptGetPayload<{
  select: typeof ALLOCATION_FIELDS;
}>;

/**
 * Invoice states that can never take money.
 *
 * Read from the invoice rather than inferred from its balance: a cancelled
 * invoice can still show an outstanding total, and applying a capture to one
 * would post money against a document nobody is going to collect.
 */
const CLOSED_INVOICE_STATUSES: ReadonlySet<string> = new Set([
  "CANCELLED",
  "REFUNDED",
]);

/**
 * Whether the money is sitting in an account this organisation's invoices
 * settle into.
 *
 * Checked even though the receipt already carries the organisation's id,
 * because the two are set by different things: attribution is a statement
 * about whose customer paid, and this is a statement about which merchant
 * account holds the funds. Applying a capture held in one tenant's connected
 * account to another tenant's invoice would move money on paper that cannot
 * move in fact.
 *
 * A PLATFORM capture passes: the sentinel is shared by every tenant, so it
 * carries no claim to check, and the receipt's attribution is then the only
 * statement of ownership there is.
 */
const receiptAccountServesOrganisation = async (
  receipt: Pick<AllocationReceipt, "merchantAccountRef">,
  organisationId: string,
): Promise<boolean> => {
  if (receipt.merchantAccountRef === PLATFORM_MERCHANT_ACCOUNT_REF) return true;
  const organisation = await prisma.organization.findUnique({
    where: { id: organisationId },
    select: { stripeAccountId: true },
  });
  return organisation?.stripeAccountId === receipt.merchantAccountRef;
};

/**
 * Whether one requested line may be applied to the invoice it names.
 *
 * A missing invoice and an invoice belonging to another organisation get the
 * SAME answer on purpose. Telling the caller which of the two it was answers
 * "does invoice X exist" for every id they care to try, across every tenant.
 */
const rejectAllocationLine = async (
  line: AllocationRequest,
  receipt: AllocationReceipt,
): Promise<AllocationRejection | null> => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: line.invoiceId, organisationId: receipt.organisationId },
    select: {
      id: true,
      currency: true,
      status: true,
      totalAmount: true,
      depositCollectedAmount: true,
    },
  });
  if (!invoice) return "INVOICE_NOT_FOUND";
  if (invoice.currency !== receipt.currency) return "CURRENCY_MISMATCH";
  if (CLOSED_INVOICE_STATUSES.has(invoice.status)) return "INVOICE_CLOSED";

  const summary = await getInvoiceFinancialSummary(
    invoice.id,
    invoice.totalAmount,
    invoice.depositCollectedAmount ?? 0,
  );
  if (summary.balance <= 0) return "NO_OUTSTANDING_BALANCE";
  if (line.amount > summary.balance) return "EXCEEDS_INVOICE_BALANCE";
  return null;
};

/**
 * Post one recorded allocation to its invoice, at most once.
 *
 * The readback is the whole mechanism. A `Payment` on that invoice carrying
 * this capture's provider reference means the money is already there - posted
 * by the webhook, or by an earlier attempt of this very call that died before
 * it could write the row back. Either way posting again would credit the
 * invoice twice for one capture, which is the failure this whole issue is
 * about, inverted.
 *
 * `recordInvoicePayment` clamps what it applies to the invoice's outstanding
 * balance, so the applied figure is read back from it rather than assumed: an
 * invoice that was partly paid between the eligibility check and here takes
 * less than was asked for, and the shortfall is returned to the receipt's
 * residual by the caller instead of being recorded as money that went
 * somewhere.
 */
const postAllocationLine = async (
  receipt: AllocationReceipt,
  row: { id: string; invoiceId: string; amount: number },
): Promise<AllocatedLine> => {
  const alreadyPosted = await prisma.payment.findFirst({
    where: {
      invoiceId: row.invoiceId,
      providerPaymentId: receipt.paymentRef,
      status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] },
    },
    select: { id: true, amount: true },
  });

  const posted = alreadyPosted
    ? { paymentId: alreadyPosted.id, amount: alreadyPosted.amount }
    : await (async () => {
        const applied = await FinancePaymentService.recordInvoicePayment(
          row.invoiceId,
          {
            provider: receipt.provider,
            amount: row.amount,
            currency: receipt.currency,
            providerPaymentId: receipt.paymentRef,
            receivedAt: receipt.capturedAt,
          },
        );
        return {
          paymentId: applied.payment?.id ?? null,
          amount: applied.appliedAmount ?? 0,
        };
      })();

  await prisma.providerReceiptAllocation.update({
    where: { id: row.id },
    data: {
      amount: posted.amount,
      paymentId: posted.paymentId,
      appliedAt: posted.paymentId ? new Date() : null,
    },
  });

  return {
    invoiceId: row.invoiceId,
    amount: posted.amount,
    paymentId: posted.paymentId,
  };
};

/**
 * Give back to the receipt's residual anything the invoices would not take.
 *
 * The compare-and-set reserves the full requested amount before any money
 * moves, because reserving afterwards would leave a window in which two
 * operators could each pass the residual check. What the invoices actually
 * took can only be smaller, so this releases the difference - and it is a
 * plain decrement rather than a recomputed total, so it cannot overwrite an
 * allocation another operator made in between.
 */
const releaseUnappliedReservation = async (
  receipt: AllocationReceipt,
  reserved: number,
  applied: number,
): Promise<void> => {
  const shortfall = roundMoney(reserved - applied);
  if (shortfall <= 0) return;

  const current = await prisma.providerReceipt.update({
    where: { id: receipt.id },
    data: {
      allocatedAmount: { decrement: shortfall },
      version: { increment: 1 },
    },
    select: {
      status: true,
      amount: true,
      refundedAmount: true,
      allocatedAmount: true,
    },
  });

  const status = allocatedReceiptStatus(current);
  if (status !== current.status) {
    await prisma.providerReceipt.update({
      where: { id: receipt.id },
      data: { status, version: { increment: 1 } },
    });
  }

  logger.warn(
    `Receipt ${receipt.id} reserved ${reserved} but its invoices took ${applied}; the difference was returned to the residual`,
  );
};

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
    const initialStatus = initialReceiptStatus(input);

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
          status: initialStatus,
          allocatedAmount: initialAllocatedAmount({
            status: initialStatus,
            amount: input.amount,
          }),
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
        select: { id: true, status: true, organisationId: true },
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

      const attributed = await attributeIfOwnerStillUnknown(existing, input);
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

  /**
   * Reverse a journalled capture by the provider's cumulative refunded figure.
   *
   * Keyed on the capture's own reference, so a refund lands on the receipt for
   * the money it is giving back and never on a sibling capture of the same
   * appointment. Without this a receipt stayed at its full captured amount
   * after the money had gone, and the issue's oracle - captured equals applied
   * plus unapplied plus refunded - had no term to read for the last one.
   *
   * The figure is cumulative and the write is conditional on being an
   * increase, so a redelivered event, an out-of-order pair of partial refunds
   * and two concurrent deliveries all converge on the provider's own total
   * rather than summing deltas into a number the provider never stated.
   *
   * It reverses the RECEIPT, not an allocation. Releasing the credit a refund
   * takes back belongs to the single account-receipt transaction in #3163;
   * `invoiceId` is left in place because it is the historical record of where
   * the money went, and erasing it would destroy the only link a
   * reconciliation has to work from.
   *
   * Never throws, for the same reason `journalCapture` does not: a webhook
   * answered non-2xx is retried forever, and the refund has happened either
   * way.
   */
  async recordRefund(
    input: RecordRefundInput,
  ): Promise<RecordRefundResult | null> {
    const merchantAccountRef =
      input.merchantAccountRef ?? PLATFORM_MERCHANT_ACCOUNT_REF;

    try {
      const existing = await prisma.providerReceipt.findUnique({
        where: {
          provider_merchantAccountRef_paymentRef: {
            provider: input.provider,
            merchantAccountRef,
            paymentRef: input.paymentRef,
          },
        },
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          refundedAmount: true,
        },
      });

      if (!existing) {
        // The capture this reverses was never journalled, so there is nothing
        // to reduce. Loud, because it means money left the account against a
        // record we do not hold.
        logger.error(
          `Refund of ${input.paymentRef} on ${merchantAccountRef} has no journalled capture to reverse`,
        );
        return null;
      }

      if (existing.currency !== input.currency) {
        // Two currencies cannot be compared, so writing this figure would put
        // a number in the journal that means nothing against the amount beside
        // it. A gap a human can see beats a total that silently does not add
        // up.
        logger.error(
          `Refund of ${input.paymentRef} on ${merchantAccountRef} is in a different currency from the capture it reverses; not recorded`,
        );
        return null;
      }

      const status = refundedReceiptStatus({
        amount: existing.amount,
        refundedAmount: input.refundedAmount,
      });

      const updated = await prisma.providerReceipt.updateMany({
        where: {
          id: existing.id,
          refundedAmount: { lt: input.refundedAmount },
        },
        data: {
          refundedAmount: input.refundedAmount,
          status,
          version: { increment: 1 },
        },
      });

      if (updated.count === 1) {
        return {
          id: existing.id,
          status,
          refundedAmount: input.refundedAmount,
          applied: true,
        };
      }

      // count 0 means the stored figure already covers this refund - a replay,
      // an event delivered behind a later one, or a concurrent delivery that
      // won. None of those is an error, and none of them makes the status this
      // call computed the stored one, so the answer comes from a fresh read.
      const persisted = await prisma.providerReceipt.findUnique({
        where: { id: existing.id },
        select: { status: true, refundedAmount: true },
      });

      return {
        id: existing.id,
        status: persisted?.status ?? existing.status,
        refundedAmount: persisted?.refundedAmount ?? existing.refundedAmount,
        applied: false,
      };
    } catch (error) {
      logger.error(
        `Could not record refund of ${input.paymentRef} on ${merchantAccountRef}`,
        error,
      );
      return null;
    }
  },

  /**
   * Apply a captured payment to one or more of its organisation's invoices
   * (#3170 delivery 2).
   *
   * The write side of the reconciliation queue. Until this existed an operator
   * could see a capture sitting against no invoice and had no way to place it,
   * so the journal recorded the gap rather than closing it.
   *
   * Three guards stand between a request and money moving, and they fail for
   * different reasons on purpose:
   *
   *   - the receipt must already have an organisation. An UNATTRIBUTED capture
   *     is refused rather than attributed by this call, because the only
   *     evidence available for whose it is would be the caller's say-so, and
   *     the issue is explicit that nothing guesses;
   *   - the request must name the `version` it was decided from, and the
   *     compare-and-set repeats every figure the decision used - so a refund,
   *     an attribution or another operator's allocation landing in between
   *     loses the write instead of silently changing what it meant;
   *   - the full amount is reserved on the receipt BEFORE any money moves.
   *     Reserving afterwards leaves a window in which two operators both pass
   *     the residual check and the capture is applied twice.
   *
   * Recorded first, posted second, and resumable in between. A crash after the
   * decision is written leaves allocation rows with no `paymentId`; a retry
   * carrying the same idempotency key finds them and finishes them rather than
   * deciding again. That is what makes a timed-out request safe to repeat, and
   * it is why posting cannot be inside the transaction: `recordInvoicePayment`
   * opens its own.
   *
   * Posts invoice payments, never an account credit. The journal still never
   * credits anything; the canonical account receipt in #3163 owns that, and
   * this applies a capture to invoices the operator named.
   */
  async allocate(input: AllocateInput): Promise<AllocateResult> {
    const lines = input.allocations.map((line) => ({
      invoiceId: line.invoiceId,
      amount: roundMoney(line.amount),
    }));
    const requested = roundMoney(
      lines.reduce((total, line) => total + line.amount, 0),
    );

    const resolved = await resolveAllocatableReceipt(
      input.receiptId,
      input.organisationId,
    );
    if ("outcome" in resolved) return resolved;
    const receipt = resolved.receipt;

    /*
     * The idempotency read comes before every other check. A retry of a
     * decision that was already taken must be answered with what happened,
     * not re-validated against a state that has since moved - the invoice it
     * was applied to now has a smaller balance, so re-validating would reject
     * the caller's own successful write.
     */
    const prior = await prisma.providerReceiptAllocation.findMany({
      where: {
        receiptId: receipt.id,
        idempotencyKey: input.idempotencyKey,
      },
      select: { id: true, invoiceId: true, amount: true, paymentId: true },
    });
    if (prior.length > 0) {
      return this.resumeAllocation(receipt, prior);
    }

    if (receipt.status === "REFUNDED") return { outcome: "FULLY_REFUNDED" };

    if (
      !(await receiptAccountServesOrganisation(receipt, input.organisationId))
    ) {
      return { outcome: "ACCOUNT_MISMATCH" };
    }

    const residual = allocatableResidual(receipt);
    if (requested > residual) {
      return { outcome: "EXCEEDS_RESIDUAL", residual, requested };
    }

    for (const line of lines) {
      const reason = await rejectAllocationLine(line, receipt);
      if (reason) {
        return {
          outcome: "INVOICE_NOT_ELIGIBLE",
          invoiceId: line.invoiceId,
          reason,
        };
      }
    }

    const status = allocatedReceiptStatus({
      status: receipt.status,
      amount: receipt.amount,
      refundedAmount: receipt.refundedAmount,
      allocatedAmount: roundMoney(receipt.allocatedAmount + requested),
    });

    let rows: { id: string; invoiceId: string; amount: number }[];
    try {
      rows = await prisma.$transaction(async (tx) => {
        /*
         * Every figure the decision was taken from is in the WHERE, not just
         * the version. The version alone would be enough while this is the
         * only writer, and it is not: a refund webhook increments it too, so
         * matching on the figures as well is what keeps the reservation
         * arithmetic conditional on the arithmetic that produced it.
         */
        const reserved = await tx.providerReceipt.updateMany({
          where: {
            id: receipt.id,
            version: input.expectedVersion,
            organisationId: input.organisationId,
            allocatedAmount: receipt.allocatedAmount,
            refundedAmount: receipt.refundedAmount,
            status: receipt.status,
          },
          data: {
            allocatedAmount: { increment: requested },
            status,
            version: { increment: 1 },
          },
        });
        if (reserved.count !== 1) throw new LostAllocationRace();

        return Promise.all(
          lines.map((line) =>
            tx.providerReceiptAllocation.create({
              data: {
                receiptId: receipt.id,
                invoiceId: line.invoiceId,
                amount: line.amount,
                idempotencyKey: input.idempotencyKey,
                actorId: input.actorId,
              },
              select: { id: true, invoiceId: true, amount: true },
            }),
          ),
        );
      });
    } catch (error) {
      return refusedReservation(error, receipt, lines);
    }

    const allocations = await this.postAllocations(receipt, rows);
    const applied = roundMoney(
      allocations.reduce((total, line) => total + line.amount, 0),
    );
    await releaseUnappliedReservation(receipt, requested, applied);

    return this.describeAllocation(receipt.id, "APPLIED", allocations);
  },

  /**
   * Finish a decision that was recorded but whose money may not have moved.
   *
   * The answer to a retry, and the reason a timed-out allocation is safe to
   * repeat. Rows that already carry a `paymentId` are left alone; rows that do
   * not are posted now, through the same readback that stops the first attempt
   * posting twice.
   *
   * No reservation is released here. The receipt's `allocatedAmount` already
   * reflects this decision, and a row that posts less than it reserved has its
   * shortfall released by the attempt that posts it.
   */
  async resumeAllocation(
    receipt: AllocationReceipt,
    prior: {
      id: string;
      invoiceId: string;
      amount: number;
      paymentId: string | null;
    }[],
  ): Promise<AllocateResult> {
    const unposted = prior.filter((row) => row.paymentId === null);
    if (unposted.length > 0) {
      logger.info(
        `Receipt ${receipt.id} was allocated but ${unposted.length} line(s) were never posted; finishing them`,
      );
      const reserved = roundMoney(
        unposted.reduce((total, row) => total + row.amount, 0),
      );
      const posted = await this.postAllocations(receipt, unposted);
      const applied = roundMoney(
        posted.reduce((total, line) => total + line.amount, 0),
      );
      await releaseUnappliedReservation(receipt, reserved, applied);
    }

    const rows = await prisma.providerReceiptAllocation.findMany({
      where: { id: { in: prior.map((row) => row.id) } },
      select: { invoiceId: true, amount: true, paymentId: true },
    });

    return this.describeAllocation(receipt.id, "REPLAYED", rows);
  },

  /** Post each recorded line in turn, at most once each. */
  async postAllocations(
    receipt: AllocationReceipt,
    rows: { id: string; invoiceId: string; amount: number }[],
  ): Promise<AllocatedLine[]> {
    const posted: AllocatedLine[] = [];
    /*
     * Sequential rather than concurrent. Two lines of one allocation can name
     * invoices whose balances are read and written by the same service, and a
     * partial failure has to leave a prefix of posted rows rather than an
     * unknown subset.
     */
    for (const row of rows) {
      posted.push(await postAllocationLine(receipt, row));
    }
    return posted;
  },

  /**
   * The state of the receipt after the call, read back rather than computed.
   *
   * The caller is told what a receipt IS. Returning the state this call
   * intended would be wrong in exactly the cases that matter - a shortfall
   * released, a refund that landed while the money was posting.
   */
  async describeAllocation(
    receiptId: string,
    outcome: "APPLIED" | "REPLAYED",
    allocations: AllocatedLine[],
  ): Promise<AllocateResult> {
    const receipt = await prisma.providerReceipt.findUnique({
      where: { id: receiptId },
      select: RECONCILIATION_FIELDS,
    });
    if (!receipt) return { outcome: "NOT_FOUND" };

    return {
      outcome,
      receipt,
      remainingAmount: allocatableResidual(receipt),
      allocations,
    };
  },
};
