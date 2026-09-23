import type { PaymentProvider as PrismaPaymentProvider } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  allocatableResidual,
  CLOSED_INVOICE_STATUSES,
  PLATFORM_MERCHANT_ACCOUNT_REF,
  ProviderReceiptService,
  type AllocateResult,
} from "src/services/finance/provider-receipt";
import { getInvoiceFinancialSummaries } from "src/services/finance/payment";
import { roundMoney } from "src/services/finance/pricing";

/**
 * A client's account credit: the money this organisation has taken from them
 * that no invoice of theirs has claimed (#3163).
 *
 * The provider receipt journal (#3170) already records every capture and
 * already tracks the part of one that no invoice took. What it does not have
 * is a CLIENT-level form of it. A residual belongs to a capture, so answering
 * "does this client have credit available" meant knowing which capture to look
 * at first, which is the wrong way round for every question an operator
 * actually asks at a client record.
 *
 * This reads, and posts nothing. `ProviderReceipt.allocatedAmount` is the
 * enforcement total for what has been applied - it is what the allocation
 * compare-and-set evaluates - and a second stored total for the same money
 * could drift from it. The issue's own locked behaviour rules that out
 * ("Invoice outstanding comes from that invoice's allocated debit, not a
 * second independent total"), so the client-level figure is derived from the
 * journal rather than accumulated beside it. When the posting table lands the
 * shape returned here does not change; only where it is read from does.
 */

/**
 * One capture contributing to a client's credit.
 *
 * The receipt is named rather than summed away because applying the credit is
 * still a per-capture action: the allocation endpoint takes a receipt id, so a
 * total with no lines would tell an operator that credit exists and not how to
 * spend it.
 */
export type ClientAccountCreditLine = {
  receiptId: string;
  provider: PrismaPaymentProvider;
  /** The provider's own reference for the capture - a Stripe intent id. */
  paymentRef: string;
  /** The client invoice this capture is attributed to. */
  invoiceId: string;
  capturedAt: Date;
  /** `amount - refundedAmount - allocatedAmount` for this capture. */
  availableCredit: number;
};

/**
 * A client's credit in ONE currency.
 *
 * Currencies are returned separately and never netted. Two captures in
 * different currencies are two amounts of money, and adding them would require
 * a rate this service does not have and must not invent - the issue is
 * explicit that currencies do not net against one another.
 */
export type ClientAccountCredit = {
  currency: string;
  availableCredit: number;
  lines: ClientAccountCreditLine[];
};

type CreditableReceipt = {
  id: string;
  provider: PrismaPaymentProvider;
  paymentRef: string;
  invoiceId: string | null;
  currency: string;
  capturedAt: Date;
  amount: number;
  refundedAmount: number;
  allocatedAmount: number;
};

/**
 * Turn the receipts into per-currency totals, dropping the ones with nothing
 * left on them.
 *
 * Exported for its own tests: it is the arithmetic half, and testing it
 * through the queries would make a rounding change look like a database
 * change.
 */
export const summariseClientCredit = (
  receipts: readonly CreditableReceipt[],
): ClientAccountCredit[] => {
  const byCurrency = new Map<string, ClientAccountCreditLine[]>();

  for (const receipt of receipts) {
    if (!receipt.invoiceId) continue;
    const availableCredit = allocatableResidual(receipt);
    if (availableCredit <= 0) continue;

    const line: ClientAccountCreditLine = {
      receiptId: receipt.id,
      provider: receipt.provider,
      paymentRef: receipt.paymentRef,
      invoiceId: receipt.invoiceId,
      capturedAt: receipt.capturedAt,
      availableCredit,
    };
    const bucket = byCurrency.get(receipt.currency);
    if (bucket) bucket.push(line);
    else byCurrency.set(receipt.currency, [line]);
  }

  return [...byCurrency.entries()]
    .map(([currency, lines]) => ({
      currency,
      availableCredit: roundMoney(
        lines.reduce((sum, line) => sum + line.availableCredit, 0),
      ),
      // Newest capture first, id breaking the tie so two captures recorded in
      // the same instant do not swap places between two reads of the same data.
      lines: [...lines].sort(
        (a, b) =>
          b.capturedAt.getTime() - a.capturedAt.getTime() ||
          b.receiptId.localeCompare(a.receiptId),
      ),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
};

/**
 * One capture this proposal would draw on.
 *
 * The `version` travels with it because applying the proposal is a
 * compare-and-set per capture: `ProviderReceiptService.allocate` refuses a
 * decision taken from state that has since moved, and the state this plan was
 * taken from is the state the operator saw. Returning it here is what lets the
 * confirming call be conditional on the preview rather than on whatever the
 * receipt happens to hold when the operator presses the button.
 */
export type ProposalCredit = {
  receiptId: string;
  version: number;
  capturedAt: Date;
  /** `amount - refundedAmount - allocatedAmount` for this capture. */
  availableCredit: number;
};

/**
 * One invoice this proposal would pay down.
 *
 * `dueAt` is `finalizedAt ?? createdAt`. DESIGN CALL, recorded so it can be
 * overridden: `Invoice` has no due-date column, and #3163 asks for
 * oldest-due-date-first. Inventing a due date from payment terms is #3175's
 * work and guessing one here would put a number in front of an operator that
 * no document backs. The date the invoice became a demand for money is the
 * closest fact the schema actually holds, and it orders the same way for every
 * invoice raised under the same terms.
 */
export type ProposalDebt = {
  invoiceId: string;
  dueAt: Date;
  /** What is still owed on it, from `getInvoiceFinancialSummaries`. */
  balance: number;
};

/** One capture applied to one invoice, as the confirming call would send it. */
export type AllocationProposalLine = {
  receiptId: string;
  invoiceId: string;
  amount: number;
};

/**
 * What applying a client's credit to their outstanding invoices would do, in
 * ONE currency.
 *
 * A proposal and not a result: nothing here is written, and the operator may
 * edit it before confirming. #3163 requires the default to be reviewable
 * rather than chosen at send time, which is the whole reason this is a
 * separate read instead of a flag on the allocation call.
 */
export type ClientAccountAllocationProposal = {
  currency: string;
  /** Credit available before this proposal. */
  availableCredit: number;
  /** What this proposal would apply. */
  proposedAmount: number;
  /** Credit this proposal would leave unapplied. */
  residualCredit: number;
  outstandingBefore: number;
  /** What the client would still owe once it was applied. */
  outstandingAfter: number;
  lines: AllocationProposalLine[];
  /** The captures drawn on, at the versions this plan was taken from. */
  credits: ProposalCredit[];
};

/**
 * One capture a confirming call would draw on, at the version its plan was
 * read from.
 *
 * The same shape the proposal returns, because the confirming call is meant to
 * be the proposal handed back. `expectedVersion` is per capture rather than per
 * request: each one is its own compare-and-set, and a refund landing on one
 * capture says nothing about the state of another.
 */
export type ClientAllocationCommand = {
  receiptId: string;
  expectedVersion: number;
  allocations: readonly { invoiceId: string; amount: number }[];
};

/** What one capture in the plan did when it was applied. */
export type ClientAllocationStep = {
  receiptId: string;
  result: AllocateResult;
};

/**
 * What confirming a plan did.
 *
 * The three refusals above the fold are checked before anything is written, so
 * they are the only outcomes that leave the money exactly where it was. Once
 * the first capture has been applied, a later refusal cannot unwind it - the
 * journal is append-only by design - so the result says how far it got rather
 * than pretending the request did nothing.
 */
export type ClientAccountAllocationResult =
  | { outcome: "DUPLICATE_RECEIPT"; receiptId: string }
  | { outcome: "RECEIPT_NOT_THIS_CLIENT"; receiptId: string }
  | { outcome: "INVOICE_NOT_THIS_CLIENT"; invoiceId: string }
  | {
      outcome: "APPLIED" | "STOPPED";
      /** What actually moved, summed from the applied lines and not the asked. */
      appliedAmount: number;
      /** Every capture attempted, in order, ending at the refusal if STOPPED. */
      steps: ClientAllocationStep[];
      /** The captures after the refusal, which were deliberately not tried. */
      notAttempted: string[];
    };

/** The key of a capture-to-invoice pairing that has already been decided. */
const allocationPairKey = (receiptId: string, invoiceId: string): string =>
  `${receiptId}:${invoiceId}`;

/**
 * Plan which captures pay which invoices.
 *
 * Oldest debt first, oldest money first. #3163 fixes the debt order; the money
 * order is this service's choice and is the same rule applied to the other
 * side, so the credit an operator has been sitting on longest is the credit
 * that leaves first.
 *
 * Both orders break their ties on the id. Two invoices raised in the same
 * instant would otherwise swap places between two reads of unchanged data, and
 * a preview that does not reproduce is not a preview an operator can confirm.
 *
 * Pairings that already exist are skipped rather than merged. The journal holds
 * a unique on (receipt, invoice), so a second decision pairing the same two is
 * refused as a double-apply - proposing one would be proposing an action that
 * cannot be taken.
 *
 * Exported for its own tests: it is the arithmetic, and driving it through the
 * queries would make a rounding change look like a database change.
 */
export const planClientAllocation = (input: {
  credits: readonly ProposalCredit[];
  debts: readonly ProposalDebt[];
  allocatedPairs: ReadonlySet<string>;
}): AllocationProposalLine[] => {
  const remaining = new Map(
    input.credits.map((credit) => [credit.receiptId, credit.availableCredit]),
  );
  const orderedCredits = [...input.credits].sort(
    (a, b) =>
      a.capturedAt.getTime() - b.capturedAt.getTime() ||
      a.receiptId.localeCompare(b.receiptId),
  );
  const orderedDebts = [...input.debts].sort(
    (a, b) =>
      a.dueAt.getTime() - b.dueAt.getTime() ||
      a.invoiceId.localeCompare(b.invoiceId),
  );

  const lines: AllocationProposalLine[] = [];
  for (const debt of orderedDebts) {
    let owed = debt.balance;
    for (const credit of orderedCredits) {
      if (owed <= 0) break;
      if (
        input.allocatedPairs.has(
          allocationPairKey(credit.receiptId, debt.invoiceId),
        )
      ) {
        continue;
      }
      const available = remaining.get(credit.receiptId) ?? 0;
      const amount = roundMoney(Math.min(available, owed));
      if (amount <= 0) continue;

      lines.push({
        receiptId: credit.receiptId,
        invoiceId: debt.invoiceId,
        amount,
      });
      remaining.set(credit.receiptId, roundMoney(available - amount));
      owed = roundMoney(owed - amount);
    }
  }
  return lines;
};

/** The zero-write refusals, the only outcomes that leave every capture as it was. */
type AllocationRefusal = Exclude<
  ClientAccountAllocationResult,
  { outcome: "APPLIED" | "STOPPED" }
>;

/**
 * Every check a plan must pass before its first capture is written. Run in
 * full before any write, because after the first one nothing can be unwound.
 */
const refuseBeforeWriting = async (input: {
  organisationId: string;
  parentId: string;
  receipts: readonly ClientAllocationCommand[];
}): Promise<AllocationRefusal | null> => {
  /*
   * A capture named twice is refused rather than merged. The second entry
   * carries this plan's idempotency key into a capture the first has already
   * decided, so it comes back REPLAYED with the FIRST entry's lines and would
   * be summed as money that moved when nothing did. The check lives here,
   * beside the sum it protects, so a caller that is not the HTTP route
   * cannot skip it.
   */
  const seenReceipts = new Set<string>();
  for (const command of input.receipts) {
    if (seenReceipts.has(command.receiptId)) {
      return { outcome: "DUPLICATE_RECEIPT", receiptId: command.receiptId };
    }
    seenReceipts.add(command.receiptId);
  }

  /*
   * A capture is this client's when it is attributed to one of their
   * invoices, which is the same statement of ownership the proposal reads.
   * Unattributed captures are excluded by that rule rather than a second
   * one: `invoiceId` is what carries the claim, so a capture nobody has
   * placed yet is not this client's either.
   *
   * Both reads are bounded by what the plan names, never by the client's
   * whole history: the captures first, for the invoices they are attributed
   * to, then only those invoices and the ones the lines name.
   */
  const captures = await prisma.providerReceipt.findMany({
    where: {
      organisationId: input.organisationId,
      id: { in: [...seenReceipts] },
    },
    select: { id: true, invoiceId: true },
  });
  const lines = input.receipts.flatMap((command) => command.allocations);
  const invoiceIdsToCheck = new Set([
    ...captures.flatMap((capture) =>
      capture.invoiceId ? [capture.invoiceId] : [],
    ),
    ...lines.map((line) => line.invoiceId),
  ]);
  const invoices = await prisma.invoice.findMany({
    where: {
      organisationId: input.organisationId,
      parentId: input.parentId,
      id: { in: [...invoiceIdsToCheck] },
    },
    select: { id: true },
  });
  const clientInvoiceIds = new Set(invoices.map((invoice) => invoice.id));

  const foreignLine = lines.find(
    (line) => !clientInvoiceIds.has(line.invoiceId),
  );
  if (foreignLine) {
    return {
      outcome: "INVOICE_NOT_THIS_CLIENT",
      invoiceId: foreignLine.invoiceId,
    };
  }

  const ownedIds = new Set(
    captures
      .filter(
        (capture) =>
          capture.invoiceId !== null && clientInvoiceIds.has(capture.invoiceId),
      )
      .map((capture) => capture.id),
  );
  const unowned = input.receipts.find(
    (command) => !ownedIds.has(command.receiptId),
  );
  return unowned
    ? { outcome: "RECEIPT_NOT_THIS_CLIENT", receiptId: unowned.receiptId }
    : null;
};

export const ClientAccountService = {
  /**
   * What credit this client has available with this organisation.
   *
   * `organisationId` is applied to BOTH sides - the invoice and the receipt.
   * A `Parent` is global rather than owned by one practice, so a client id on
   * its own is not a tenancy boundary and filtering on it alone would return
   * another practice's captures for a client both of them see. Requiring the
   * organisation on the invoice as well means an invoice with no organisation
   * is excluded rather than matched, which is the safe direction: the credit
   * is not shown, instead of being shown to whoever asked.
   *
   * The client's invoices are read first and the receipts second, rather than
   * the other way round. A client has tens of invoices and an organisation
   * accumulates captures without bound, so this orders the two reads by the
   * one that is small.
   *
   * Returns a total rather than a page. A paged balance is not a balance, so
   * there is deliberately no cursor here; the bound is that a client's own
   * invoices are a bounded set in a way an organisation's captures are not.
   */
  async getAccountCredit(input: {
    organisationId: string;
    parentId: string;
  }): Promise<ClientAccountCredit[]> {
    const invoices = await prisma.invoice.findMany({
      where: {
        organisationId: input.organisationId,
        parentId: input.parentId,
      },
      select: { id: true },
    });
    if (invoices.length === 0) return [];

    const receipts = await prisma.providerReceipt.findMany({
      where: {
        organisationId: input.organisationId,
        invoiceId: { in: invoices.map((invoice) => invoice.id) },
      },
      select: {
        id: true,
        provider: true,
        paymentRef: true,
        invoiceId: true,
        currency: true,
        capturedAt: true,
        amount: true,
        refundedAmount: true,
        allocatedAmount: true,
      },
    });

    /*
     * Not filtered by `status`. The status is a label derived from the same
     * three figures this sums, and where the two disagree the figures are what
     * the allocation compare-and-set enforces - so reading the label would
     * answer a different question from the one the money answers.
     */
    return summariseClientCredit(receipts);
  },
  /**
   * What applying this client's credit to their outstanding invoices would do
   * (#3163), per currency, writing nothing.
   *
   * The default #3163 asks for is oldest debt first with the residual left as
   * unapplied credit, reviewable before it is confirmed. This produces exactly
   * the lines the confirming call would send, at the versions they were taken
   * from, so confirming is a compare-and-set against the state the operator
   * saw rather than against whatever the receipts hold a minute later.
   *
   * Only captures this organisation could actually apply are drawn on. A
   * capture sitting in a merchant account that is not this organisation's is
   * refused by the allocation call, and a preview that proposes a refused
   * action is worse than no preview. That makes the total here legitimately
   * smaller than `getAccountCredit`, which answers a different question - what
   * the client has paid that no invoice claimed, whichever account it landed
   * in.
   *
   * Currencies are planned separately and never netted, for the same reason
   * the credit read returns them separately.
   */
  async proposeAllocation(input: {
    organisationId: string;
    parentId: string;
  }): Promise<ClientAccountAllocationProposal[]> {
    const invoices = await prisma.invoice.findMany({
      where: {
        organisationId: input.organisationId,
        parentId: input.parentId,
      },
      select: {
        id: true,
        currency: true,
        status: true,
        totalAmount: true,
        depositCollectedAmount: true,
        finalizedAt: true,
        createdAt: true,
      },
    });
    if (invoices.length === 0) return [];

    const [receipts, organisation] = await Promise.all([
      prisma.providerReceipt.findMany({
        where: {
          organisationId: input.organisationId,
          invoiceId: { in: invoices.map((invoice) => invoice.id) },
        },
        select: {
          id: true,
          merchantAccountRef: true,
          currency: true,
          capturedAt: true,
          amount: true,
          refundedAmount: true,
          allocatedAmount: true,
          version: true,
        },
      }),
      prisma.organization.findUnique({
        where: { id: input.organisationId },
        select: { stripeAccountId: true },
      }),
    ]);

    /*
     * The PLATFORM sentinel is shared by every tenant, so it carries no claim
     * to check and the receipt's attribution is the only statement of
     * ownership there is - the same rule the allocation call applies.
     *
     * The residual is the only other filter. Money already given back is
     * already subtracted from it, and a capture is marked REFUNDED on exactly
     * the condition that leaves no residual, so checking the status as well
     * would be a second guard on the same fact with no case of its own.
     */
    const spendable = receipts.filter(
      (receipt) =>
        (receipt.merchantAccountRef === PLATFORM_MERCHANT_ACCOUNT_REF ||
          receipt.merchantAccountRef === organisation?.stripeAccountId) &&
        allocatableResidual(receipt) > 0,
    );
    if (spendable.length === 0) return [];

    const openInvoices = invoices.filter(
      (invoice) => !CLOSED_INVOICE_STATUSES.has(invoice.status),
    );
    const [summaries, existing] = await Promise.all([
      getInvoiceFinancialSummaries(openInvoices),
      prisma.providerReceiptAllocation.findMany({
        where: { receiptId: { in: spendable.map((receipt) => receipt.id) } },
        select: { receiptId: true, invoiceId: true },
      }),
    ]);
    const allocatedPairs = new Set(
      existing.map((allocation) =>
        allocationPairKey(allocation.receiptId, allocation.invoiceId),
      ),
    );

    /*
     * A settled invoice is carried rather than filtered out. Its balance is
     * zero, the planner takes nothing from a debt with nothing owed on it, and
     * zero adds nothing to the outstanding total - so a second expression of
     * "non-positive means nothing to pay" here would have no case of its own.
     */
    const debtsByCurrency = new Map<string, ProposalDebt[]>();
    for (const invoice of openInvoices) {
      const debt: ProposalDebt = {
        invoiceId: invoice.id,
        dueAt: invoice.finalizedAt ?? invoice.createdAt,
        balance: summaries.get(invoice.id)?.balance ?? 0,
      };
      const bucket = debtsByCurrency.get(invoice.currency);
      if (bucket) bucket.push(debt);
      else debtsByCurrency.set(invoice.currency, [debt]);
    }

    const creditsByCurrency = new Map<string, ProposalCredit[]>();
    for (const receipt of spendable) {
      const credit: ProposalCredit = {
        receiptId: receipt.id,
        version: receipt.version,
        capturedAt: receipt.capturedAt,
        availableCredit: allocatableResidual(receipt),
      };
      const bucket = creditsByCurrency.get(receipt.currency);
      if (bucket) bucket.push(credit);
      else creditsByCurrency.set(receipt.currency, [credit]);
    }

    return [...creditsByCurrency.entries()]
      .map(([currency, credits]) => {
        const debts = debtsByCurrency.get(currency) ?? [];
        const lines = planClientAllocation({ credits, debts, allocatedPairs });
        const availableCredit = roundMoney(
          credits.reduce((sum, credit) => sum + credit.availableCredit, 0),
        );
        const outstandingBefore = roundMoney(
          debts.reduce((sum, debt) => sum + debt.balance, 0),
        );
        const proposedAmount = roundMoney(
          lines.reduce((sum, line) => sum + line.amount, 0),
        );
        return {
          currency,
          availableCredit,
          proposedAmount,
          residualCredit: roundMoney(availableCredit - proposedAmount),
          outstandingBefore,
          outstandingAfter: roundMoney(outstandingBefore - proposedAmount),
          lines,
          /*
           * Every capture in this currency, not only the ones a line drew on.
           * A capture the plan left untouched is still part of the state the
           * plan was taken from, and an operator who edits the lines before
           * confirming needs its version as much as the others.
           */
          credits,
        };
      })
      .sort((a, b) => a.currency.localeCompare(b.currency));
  },
  /**
   * Apply a reviewed allocation plan across a client's captures (#3163).
   *
   * Each capture goes through `ProviderReceiptService.allocate`, which already
   * owns the per-capture compare-and-set, the idempotent replay and the invoice
   * eligibility rules. Nothing here re-implements any of that: this is the
   * client-level frame around it, and the two things it adds are the two that
   * a per-capture call cannot see.
   *
   * The first is whose money this is. `allocate` checks the organisation, and
   * an organisation holds captures for every client it has invoiced - so
   * without a check here, this route would take one client's credit and put it
   * against another client's debt, inside the same tenant and with every
   * per-capture guard satisfied. #3163 locks account identity to
   * `(organisationId, parentId, currency)` for exactly that reason. Both the
   * captures and the invoices named are required to be this client's, and both
   * are checked before the first write.
   *
   * The second is order. Two captures paying one invoice is the normal output
   * of the planner, and the second one's line was sized against the balance
   * the first one has since reduced - so the captures are applied one at a
   * time, in the order the plan gave them, never concurrently.
   *
   * One `idempotencyKey` covers the whole plan. The key is read per capture
   * downstream, so replaying the plan replays each capture, and a batch that
   * stopped half way finishes the rest when it is sent again.
   */
  async applyAllocation(input: {
    organisationId: string;
    parentId: string;
    actorId: string;
    idempotencyKey: string;
    receipts: readonly ClientAllocationCommand[];
  }): Promise<ClientAccountAllocationResult> {
    const refusal = await refuseBeforeWriting(input);
    if (refusal) return refusal;

    const steps: ClientAllocationStep[] = [];
    let appliedAmount = 0;
    for (const [index, command] of input.receipts.entries()) {
      const result = await ProviderReceiptService.allocate({
        organisationId: input.organisationId,
        receiptId: command.receiptId,
        expectedVersion: command.expectedVersion,
        idempotencyKey: input.idempotencyKey,
        actorId: input.actorId,
        allocations: command.allocations,
      });
      steps.push({ receiptId: command.receiptId, result });

      if (result.outcome !== "APPLIED" && result.outcome !== "REPLAYED") {
        /*
         * Stopped rather than skipped. The plan is one decision about one pool
         * of money: if a capture in the middle of it has moved, the lines
         * after it were sized against a total that no longer holds, and
         * applying them anyway would put money where a preview the operator
         * never saw would have put it.
         */
        return {
          outcome: "STOPPED",
          appliedAmount: roundMoney(appliedAmount),
          steps,
          notAttempted: input.receipts
            .slice(index + 1)
            .map((pending) => pending.receiptId),
        };
      }

      /*
       * Summed from what came back, not from what was sent. A capture can
       * apply less than its line asked for - an invoice balance that shrank
       * between the preview and the confirm takes what is left of it - and the
       * figure an operator is shown has to be the money that moved.
       */
      appliedAmount = roundMoney(
        appliedAmount +
          result.allocations.reduce((sum, line) => sum + line.amount, 0),
      );
    }

    return {
      outcome: "APPLIED",
      appliedAmount: roundMoney(appliedAmount),
      steps,
      notAttempted: [],
    };
  },
};
