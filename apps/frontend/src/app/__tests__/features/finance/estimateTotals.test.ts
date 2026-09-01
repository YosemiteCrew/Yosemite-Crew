import {
  computeEstimateTotals,
  computeLineTotal,
} from '@/app/features/finance/pages/Estimates/Sections/estimateTotals';
import type { EstimateItemInput } from '@/app/features/finance/types/estimate';

/**
 * `computeTotals` from `apps/backend/src/services/estimate.service.ts` (line 51),
 * transcribed verbatim.
 *
 * The client preview and the server have to agree operation for operation, not
 * just to a rounded penny: the estimate the user reads and approves in the
 * editor is the one the service then writes to `subtotal` / `taxAmount` /
 * `total`. Comparing against a copy of the server's own loop is what makes the
 * parity block below a regression test rather than a restatement of the client.
 */
const backendComputeTotals = (items: EstimateItemInput[]) => {
  let subtotal = 0;
  let taxAmount = 0;
  for (const item of items) {
    const lineTotal = item.quantity * item.unitPrice;
    const lineTax = lineTotal * ((item.taxRate ?? 0) / 100);
    subtotal += lineTotal;
    taxAmount += lineTax;
  }
  return { subtotal, taxAmount, total: subtotal + taxAmount };
};

const CONSULTATION: EstimateItemInput = {
  description: 'Consultation',
  quantity: 2,
  unitPrice: 45,
  taxRate: 0,
};

const VACCINE: EstimateItemInput = {
  description: 'Vaccine',
  quantity: 1,
  unitPrice: 30.5,
  taxRate: 5,
};

const DENTAL: EstimateItemInput = {
  description: 'Dental scale and polish',
  quantity: 2,
  unitPrice: 50,
  taxRate: 20,
};

/** A line the create form left untouched, so `taxRate` is absent rather than 0. */
const UNTAXED_KEY_ABSENT: EstimateItemInput = {
  description: 'Nail clip',
  quantity: 3,
  unitPrice: 12,
};

describe('computeEstimateTotals', () => {
  it('returns zeroes for an estimate with no lines', () => {
    expect(computeEstimateTotals([])).toEqual({ subtotal: 0, taxAmount: 0, total: 0 });
  });

  it('totals a single untaxed line', () => {
    expect(computeEstimateTotals([CONSULTATION])).toEqual({
      subtotal: 90,
      taxAmount: 0,
      total: 90,
    });
  });

  it('sums multiple lines', () => {
    // 1.5250000000000001, not 1.525: neither side rounds, and the backend's
    // identical loop produces the identical float, so pinning the artefact is
    // what proves the two agree. Rounding belongs at the render edge.
    expect(computeEstimateTotals([CONSULTATION, VACCINE])).toEqual({
      subtotal: 120.5,
      taxAmount: 30.5 * (5 / 100),
      total: 122.025,
    });
    expect(computeEstimateTotals([CONSULTATION, VACCINE]).taxAmount).toBeCloseTo(1.525, 10);
  });

  it('treats an omitted taxRate as 0 rather than NaN', () => {
    const totals = computeEstimateTotals([UNTAXED_KEY_ABSENT]);

    expect(totals).toEqual({ subtotal: 36, taxAmount: 0, total: 36 });
    expect(Number.isNaN(totals.taxAmount)).toBe(false);
  });

  it('applies a 20% rate to that line only, leaving the line total pre-tax', () => {
    expect(computeEstimateTotals([DENTAL])).toEqual({
      subtotal: 100,
      taxAmount: 20,
      total: 120,
    });
  });

  it('keeps fractional money unrounded, e.g. 3 x 19.99', () => {
    expect(
      computeEstimateTotals([{ description: 'Wormer', quantity: 3, unitPrice: 19.99 }])
    ).toEqual({ subtotal: 59.97, taxAmount: 0, total: 59.97 });
  });

  it('keeps fractional money unrounded once tax is on it too', () => {
    expect(
      computeEstimateTotals([{ description: 'Wormer', quantity: 3, unitPrice: 19.99, taxRate: 20 }])
    ).toEqual({ subtotal: 59.97, taxAmount: 11.994, total: 71.964 });
  });

  it('rates each line separately instead of applying one rate to the subtotal', () => {
    const totals = computeEstimateTotals([DENTAL, VACCINE]);

    // Per line: 100 @ 20% = 20, and 30.5 @ 5% = 1.525.
    expect(totals.taxAmount).toBe(21.525);
    // A single blended rate over the 130.5 subtotal would land anywhere between
    // 6.525 (all 5%) and 26.1 (all 20%), so this pins the per-line shape.
    expect(totals.taxAmount).not.toBe(130.5 * 0.2);
    expect(totals.taxAmount).not.toBe(130.5 * 0.05);
  });

  it('excludes tax from the subtotal and folds it back in for the total', () => {
    const totals = computeEstimateTotals([DENTAL, VACCINE]);

    expect(totals.subtotal).toBe(computeLineTotal(2, 50) + computeLineTotal(1, 30.5));
    expect(totals.total).toBe(totals.subtotal + totals.taxAmount);
  });
});

describe('computeEstimateTotals matches the backend computeTotals', () => {
  const CASES: ReadonlyArray<readonly [string, EstimateItemInput[]]> = [
    ['no lines', []],
    ['one untaxed line', [CONSULTATION]],
    ['one line with taxRate omitted', [UNTAXED_KEY_ABSENT]],
    ['one line at 20%', [DENTAL]],
    ['mixed rates across lines', [DENTAL, VACCINE, CONSULTATION]],
    [
      'fractional unit price',
      [{ description: 'Wormer', quantity: 3, unitPrice: 19.99, taxRate: 20 }],
    ],
    ['a zero-quantity line', [{ description: 'Removed', quantity: 0, unitPrice: 80, taxRate: 20 }]],
    [
      'a credit line',
      [DENTAL, { description: 'Goodwill credit', quantity: 1, unitPrice: -25, taxRate: 20 }],
    ],
  ];

  it.each(CASES)('agrees on %s, to the last bit of the float', (_label, items) => {
    expect(computeEstimateTotals(items)).toEqual(backendComputeTotals(items));
  });

  it('keeps the same three-key shape the service returns', () => {
    expect(Object.keys(computeEstimateTotals([DENTAL])).sort()).toEqual([
      'subtotal',
      'taxAmount',
      'total',
    ]);
  });
});

describe('computeLineTotal', () => {
  it('multiplies quantity by unit price', () => {
    expect(computeLineTotal(3, 20)).toBe(60);
  });

  it('excludes tax, matching the lineTotal the service writes', () => {
    // estimate.service.ts writes `lineTotal: item.quantity * item.unitPrice`
    // on create and on update, with taxRate stored beside it, never inside it.
    expect(computeLineTotal(DENTAL.quantity, DENTAL.unitPrice)).toBe(100);
    expect(computeEstimateTotals([DENTAL]).subtotal).toBe(100);
  });

  it('returns 0 for a zero quantity', () => {
    expect(computeLineTotal(0, 199)).toBe(0);
  });

  it('keeps fractional prices unrounded', () => {
    expect(computeLineTotal(3, 19.99)).toBe(59.97);
  });

  it('carries a negative unit price through as a credit', () => {
    expect(computeLineTotal(2, -15.25)).toBe(-30.5);
  });
});
