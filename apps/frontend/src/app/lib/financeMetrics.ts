import { Invoice } from '@yosemite-crew/types';

const SETTLED_STATUSES = new Set(['PAID', 'REFUNDED', 'CANCELLED']);
const COLLECTED_STATUSES = new Set(['PAID']);
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Outstanding balance still owed on a single invoice.
 * Prefers the settlement summary balance when the backend provides it, otherwise
 * falls back to total minus any collected deposit. Settled invoices owe nothing.
 */
export const getInvoiceOutstanding = (invoice?: Invoice | null): number => {
  if (!invoice) return 0;

  const summaryBalance = invoice.settlementSummary?.balance;
  if (typeof summaryBalance === 'number') {
    return Math.max(0, summaryBalance);
  }

  if (SETTLED_STATUSES.has(invoice.status)) return 0;

  const deposit = invoice.depositCollectedAmount ?? 0;
  return Math.max(0, (invoice.totalAmount ?? 0) - deposit);
};

const toTimestamp = (value?: Date | string | null): number => {
  if (!value) return Number.NaN;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.NaN : time;
};

export type FinanceMetrics = {
  collectedThisWeek: number;
  outstanding: number;
};

/**
 * Aggregate headline numbers for the finance list header:
 * money collected in the trailing 7 days and total outstanding balance.
 */
export const computeFinanceMetrics = (
  invoices: Invoice[],
  now: number = Date.now()
): FinanceMetrics => {
  let collectedThisWeek = 0;
  let outstanding = 0;

  for (const invoice of invoices) {
    outstanding += getInvoiceOutstanding(invoice);

    if (!COLLECTED_STATUSES.has(invoice.status)) continue;

    const paidTime = toTimestamp(invoice.paidAt) || toTimestamp(invoice.createdAt);
    if (Number.isNaN(paidTime)) continue;
    if (now - paidTime > WEEK_IN_MS) continue;

    collectedThisWeek += invoice.totalAmount ?? 0;
  }

  return { collectedThisWeek, outstanding };
};
