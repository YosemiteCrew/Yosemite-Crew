import {
  effectiveStockHealthKey,
  isBelowReorderPoint,
} from '@/app/features/inventory/pages/Inventory/utils';

/**
 * The production defect: /inventory showed "0 items below reorder point"
 * directly above a panel headed "Low stock 21". The header counted only
 * LOW_STOCK; the panel used the server rule `onHand <= reorderLevel`, which
 * includes zero. Two of the three rows on screen read "OUT OF STOCK".
 */
// Shape taken from what stockHealth actually reads: stock.available and
// stock.reorderLevel, not a flat onHand.
const item = (available: number, reorderLevel: number) =>
  ({
    stock: { available, current: available, reorderLevel },
    basicInfo: { status: 'ACTIVE' },
    status: 'ACTIVE',
  }) as unknown as Parameters<typeof effectiveStockHealthKey>[0];

describe('isBelowReorderPoint', () => {
  it('counts an out-of-stock item, which is below reorder point by definition', () => {
    const zero = item(0, 5);
    // The precondition that made the bug invisible: zero is never LOW_STOCK,
    // because stockHealth returns OUT_OF_STOCK first.
    expect(effectiveStockHealthKey(zero)).toBe('OUT_OF_STOCK');
    expect(isBelowReorderPoint(zero)).toBe(true);
  });

  it('counts a low-stock item', () => {
    const low = item(7, 10);
    expect(effectiveStockHealthKey(low)).toBe('LOW_STOCK');
    expect(isBelowReorderPoint(low)).toBe(true);
  });

  it('does not count an item above its reorder point', () => {
    expect(isBelowReorderPoint(item(50, 10))).toBe(false);
  });

  it('reconciles the header with the panel on the reported data', () => {
    // 7/10 low, 0/5 out of stock, 0/100 out of stock: the panel said 3, the
    // header said 1. They must now agree.
    const rows = [item(7, 10), item(0, 5), item(0, 100), item(80, 10)];
    expect(rows.filter(isBelowReorderPoint)).toHaveLength(3);
  });
});
