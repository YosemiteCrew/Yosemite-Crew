import { formatMoneyPrecise } from '@/app/lib/money';
import type { ProviderReceipt } from '@/app/features/finance/types/providerReceipt';
import {
  allocatableResidual,
  roundMoney,
  type AllocatableInvoice,
} from '@/app/features/finance/pages/PaymentReconciliation/receiptPresentation';

/**
 * The rules for one in-progress allocation, as a function rather than as state
 * inside the dialog.
 *
 * Every figure the operator is shown before they commit money is computed
 * here, so each rule can be driven directly and broken one at a time. The same
 * arithmetic reached only through a render is the shape that ships a preview
 * disagreeing with what the endpoint does.
 *
 * These mirror the checks the allocate route enforces. They are not a
 * substitute for them: the server refuses anything that got past this, and its
 * sentence is what the dialog shows. What they buy is that the operator is not
 * asked to submit something already known to be refused.
 */

/** The route takes at most twenty lines in one request. */
export const MAX_ALLOCATION_LINES = 20;

/**
 * Amounts are read from text, and only in the form money is written in.
 *
 * A `<input type="number">` would accept `1e3` and `-0`, and its `valueAsNumber`
 * hides which of "empty" and "not a number" the operator typed. This takes a
 * plain decimal with at most two places - the scale every figure on the wire is
 * rounded to - and answers null for anything else, so "0.005" is a question the
 * form asks rather than a hundredth of a unit that silently disappears.
 */
const DECIMAL = /^\d+(\.\d{1,2})?$/;

export const parseAmount = (text: string): number | null => {
  const trimmed = text.trim();
  if (!DECIMAL.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
};

export type AllocationDraft = Readonly<Record<string, string>>;

export type ReviewedLine = {
  invoice: AllocatableInvoice;
  amount: number | null;
  /** Null when this line is fine on its own terms. */
  error: string | null;
};

export type AllocationReview = {
  lines: ReviewedLine[];
  /** What the selected lines add up to. Invalid lines contribute nothing. */
  total: number;
  /** What the capture would have left afterwards. Never below zero. */
  residualAfter: number;
  /** The residual the draft is being measured against. */
  residual: number;
  /** A problem with the draft as a whole rather than with one line. */
  formError: string | null;
  canSubmit: boolean;
};

const lineError = (line: AllocatableInvoice, amount: number | null): string | null => {
  if (amount === null) return 'Enter an amount in this currency, to at most two decimal places.';
  if (amount <= 0) return 'Enter an amount greater than zero.';
  if (amount > line.balance) {
    return `More than this invoice still owes (${formatMoneyPrecise(line.balance, line.currency)}).`;
  }
  return null;
};

/**
 * A form-level problem, chosen so only one is ever shown.
 *
 * Ordered by what the operator has to do about it: nothing selected is a
 * prompt, too many lines is a limit, and over-allocating is the one that is
 * about the money. Reporting all three at once would bury the last behind the
 * first two.
 */
const formError = (
  selectedCount: number,
  total: number,
  residual: number,
  currency: string
): string | null => {
  if (selectedCount === 0) return 'Choose at least one invoice to apply this payment to.';
  if (selectedCount > MAX_ALLOCATION_LINES) {
    return `Apply this payment to at most ${MAX_ALLOCATION_LINES} invoices at a time.`;
  }
  if (total > residual) {
    return `That is ${formatMoneyPrecise(roundMoney(total - residual), currency)} more than this capture has left to apply.`;
  }
  return null;
};

/**
 * Review a draft against the capture it would be applied from.
 *
 * `selected` is passed separately from the amounts so an invoice can be ticked
 * before an amount is typed into it: a line with an empty box is a line the
 * operator has not finished, which is a different state from one they never
 * chose, and only the first should block the submit with an error beside it.
 */
export const reviewAllocationDraft = (
  receipt: ProviderReceipt,
  invoices: readonly AllocatableInvoice[],
  selected: readonly string[],
  draft: AllocationDraft
): AllocationReview => {
  const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const residual = allocatableResidual(receipt);

  const lines: ReviewedLine[] = selected.flatMap((id) => {
    const invoice = byId.get(id);
    if (!invoice) return [];
    const amount = parseAmount(draft[id] ?? '');
    return [{ invoice, amount, error: lineError(invoice, amount) }];
  });

  const total = roundMoney(
    lines.reduce(
      (sum, line) => (line.error === null && line.amount !== null ? sum + line.amount : sum),
      0
    )
  );
  const problem = formError(lines.length, total, residual, receipt.currency);

  return {
    lines,
    total,
    residual,
    residualAfter: roundMoney(Math.max(0, residual - total)),
    formError: problem,
    canSubmit: problem === null && lines.every((line) => line.error === null),
  };
};

/**
 * What to put in the box when an invoice is ticked.
 *
 * The smaller of what the capture has left and what the invoice still owes -
 * the largest figure that is valid on both counts, which is the one an
 * operator working a queue almost always wants. It is a starting value, not a
 * decision: every line is editable and the review above judges what they leave.
 */
export const suggestedAmount = (invoice: AllocatableInvoice, remainingResidual: number): string => {
  const value = roundMoney(Math.min(invoice.balance, Math.max(0, remainingResidual)));
  return value > 0 ? value.toFixed(2) : '';
};
