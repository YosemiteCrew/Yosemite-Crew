import type { PaymentProvider as PrismaPaymentProvider } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { allocatableResidual } from "src/services/finance/provider-receipt";
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
};
