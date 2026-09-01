import type { EstimateItemInput } from '@/app/features/finance/types/estimate';

export type EstimateTotals = {
  subtotal: number;
  taxAmount: number;
  total: number;
};

/**
 * Client-side preview of an estimate's totals.
 *
 * Deliberately mirrors `computeTotals` in `apps/backend/src/services/
 * estimate.service.ts`: the line total excludes tax, tax is applied per line as
 * a percentage of that line, and the estimate total is the sum of both. If the
 * two ever diverge, the figure the user approves is not the figure that is
 * saved, so the editor's arithmetic has to stay pinned to the server's.
 */
export const computeEstimateTotals = (items: EstimateItemInput[]): EstimateTotals => {
  let subtotal = 0;
  let taxAmount = 0;
  for (const item of items) {
    const lineTotal = item.quantity * item.unitPrice;
    subtotal += lineTotal;
    taxAmount += lineTotal * ((item.taxRate ?? 0) / 100);
  }
  return { subtotal, taxAmount, total: subtotal + taxAmount };
};

/** One line's pre-tax total, matching `EstimateItem.lineTotal` as the backend writes it. */
export const computeLineTotal = (quantity: number, unitPrice: number): number =>
  quantity * unitPrice;
