import {
  InventoryItem,
  InventoryTurnoverItem,
} from '@/app/features/inventory/pages/Inventory/types';
import {
  buildAbcRows,
  buildMonthlyTurnover,
  buildProductPanel,
  computeAnnualTurnover,
  computeAvgDaysOnShelf,
  computeExpiredWriteOff,
  computeStockValue,
  computeSuggestedOrder,
  formatCurrency,
  formatTurns,
  getCurrency,
  getOnHand,
  getReorderPoint,
  getUnitCost,
  isLowStock,
  selectDefaultProduct,
  toNumber,
} from '@/app/features/inventory/components/TurnoverAnalytics/metrics';

type ItemOverrides = {
  id?: string;
  name?: string;
  subCategory?: string;
  form?: string;
  current?: string;
  reorderLevel?: string;
  abcClass?: string;
  purchaseCost?: string;
  currency?: string;
  batches?: { expiryDate?: string; quantity?: string }[];
};

const makeItem = (overrides: ItemOverrides = {}): InventoryItem =>
  ({
    id: overrides.id ?? 'item-1',
    currency: overrides.currency,
    basicInfo: {
      name: overrides.name ?? 'Carprofen 100 mg',
      category: 'Medicine',
      subCategory: overrides.subCategory ?? '',
      department: 'Pharmacy',
      description: '',
      status: 'Active',
    },
    classification: { form: overrides.form },
    pricing: { purchaseCost: overrides.purchaseCost ?? '2' },
    vendor: {
      supplierName: '',
      brand: '',
      vendor: '',
      license: '',
      paymentTerms: '',
    },
    stock: {
      current: overrides.current ?? '10',
      allocated: '0',
      available: '10',
      reorderLevel: overrides.reorderLevel ?? '5',
      reorderQuantity: '0',
      stockLocation: 'Pharmacy',
      abcClass: overrides.abcClass,
    },
    batch: { batch: '', manufactureDate: '', expiryDate: '' },
    batches: overrides.batches?.map((b) => ({
      batch: 'B1',
      manufactureDate: '',
      expiryDate: b.expiryDate ?? '',
      quantity: b.quantity,
    })),
  }) as InventoryItem;

const makeTurnover = (overrides: Partial<InventoryTurnoverItem> = {}): InventoryTurnoverItem => ({
  itemId: overrides.itemId,
  name: overrides.name ?? 'Carprofen 100 mg',
  beginningInventory: 0,
  endingInventory: 0,
  turnsPerYear: overrides.turnsPerYear ?? 6,
  daysOnShelf: overrides.daysOnShelf ?? 40,
  ...overrides,
});

describe('turnover metrics', () => {
  describe('toNumber', () => {
    it('handles numbers, strings, and junk', () => {
      expect(toNumber(4)).toBe(4);
      expect(toNumber(Number.NaN)).toBe(0);
      expect(toNumber(Number.POSITIVE_INFINITY)).toBe(0);
      expect(toNumber('12.5')).toBe(12.5);
      expect(toNumber('abc')).toBe(0);
      expect(toNumber(undefined)).toBe(0);
      expect(toNumber({})).toBe(0);
    });
  });

  it('reads numeric stock fields', () => {
    const item = makeItem({ current: '12', reorderLevel: '40', purchaseCost: '3.5' });
    expect(getOnHand(item)).toBe(12);
    expect(getReorderPoint(item)).toBe(40);
    expect(getUnitCost(item)).toBe(3.5);
  });

  it('resolves currency with and without a source', () => {
    expect(getCurrency([])).toBe('EUR');
    expect(getCurrency([makeItem({ currency: 'USD' })])).toBe('USD');
    expect(getCurrency([makeItem({})])).toBe('EUR');
  });

  describe('formatCurrency', () => {
    it('formats, degrades null, and survives an invalid code', () => {
      expect(formatCurrency(null)).toBe('—');
      expect(formatCurrency(18420, 'EUR')).toContain('18,420');
      expect(formatCurrency(100, 'XXXXX')).toBe('100');
    });
  });

  it('formats turnover values', () => {
    expect(formatTurns(null)).toBe('—');
    expect(formatTurns(6.4)).toBe('6.4×');
  });

  describe('computeStockValue', () => {
    it('returns null with no inventory and sums otherwise', () => {
      expect(computeStockValue([])).toBeNull();
      const total = computeStockValue([
        makeItem({ current: '10', purchaseCost: '2' }),
        makeItem({ id: 'i2', current: '5', purchaseCost: '4' }),
      ]);
      expect(total).toBe(40);
    });
  });

  describe('computeAvgDaysOnShelf', () => {
    it('averages and rounds, or returns null', () => {
      expect(computeAvgDaysOnShelf([])).toBeNull();
      expect(
        computeAvgDaysOnShelf([
          makeTurnover({ daysOnShelf: 50 }),
          makeTurnover({ daysOnShelf: 65 }),
        ])
      ).toBe(58);
      expect(
        computeAvgDaysOnShelf([{ ...makeTurnover(), daysOnShelf: undefined as unknown as number }])
      ).toBeNull();
    });
  });

  describe('computeAnnualTurnover', () => {
    it('prefers the org figure, falls back to the row average, else null', () => {
      expect(computeAnnualTurnover(6.4, [])).toBe(6.4);
      expect(
        computeAnnualTurnover(0, [
          makeTurnover({ turnsPerYear: 4 }),
          makeTurnover({ turnsPerYear: 8 }),
        ])
      ).toBe(6);
      expect(computeAnnualTurnover(0, [])).toBeNull();
      expect(
        computeAnnualTurnover(0, [
          { ...makeTurnover(), turnsPerYear: undefined as unknown as number },
        ])
      ).toBeNull();
    });
  });

  describe('computeExpiredWriteOff', () => {
    const reference = new Date('2026-07-11');
    it('returns null with no inventory', () => {
      expect(computeExpiredWriteOff([])).toBeNull();
    });
    it('values only past-dated batches', () => {
      const value = computeExpiredWriteOff(
        [
          makeItem({
            purchaseCost: '2',
            batches: [
              { expiryDate: '2026-01-01', quantity: '5' }, // expired → 10
              { expiryDate: '2027-01-01', quantity: '9' }, // future → ignored
              { quantity: '3' }, // no date → ignored
              { expiryDate: 'not-a-date', quantity: '3' }, // NaN → ignored
            ],
          }),
        ],
        reference
      );
      expect(value).toBe(10);
    });
    it('returns 0 when nothing is expired but inventory exists', () => {
      expect(computeExpiredWriteOff([makeItem({ batches: [] })], reference)).toBe(0);
    });
    it('treats a missing batches array as empty', () => {
      expect(computeExpiredWriteOff([makeItem({})], reference)).toBe(0);
    });
  });

  describe('buildMonthlyTurnover', () => {
    it('flags no data on an empty trend', () => {
      const result = buildMonthlyTurnover([]);
      expect(result.hasData).toBe(false);
      expect(result.bars).toEqual([]);
    });
    it('groups current vs previous year and highlights the last month', () => {
      const result = buildMonthlyTurnover([
        { month: 'Jan', year: 2026, turnover: 5 },
        { month: 'Jan', year: 2025, turnover: 4 },
        { month: 'Feb', year: 2026, turnover: 6 },
        { month: 'Mar', year: 2025, turnover: 3 }, // previous-year-only month
      ]);
      expect(result.currentYear).toBe(2026);
      expect(result.previousYear).toBe(2025);
      expect(result.maxValue).toBe(6);
      const jan = result.bars.find((b) => b.month === 'Jan');
      expect(jan?.currentValue).toBe(5);
      expect(jan?.previousValue).toBe(4);
      const mar = result.bars.find((b) => b.month === 'Mar');
      expect(mar?.currentValue).toBeNull();
      expect(mar?.previousValue).toBe(3);
      expect(result.bars.at(-1)?.highlight).toBe(true);
      expect(result.bars[0].highlight).toBe(false);
    });
  });

  describe('buildAbcRows', () => {
    it('returns empty when nothing is classified', () => {
      expect(buildAbcRows([makeItem({ abcClass: undefined })], [])).toEqual([]);
    });
    it('aggregates counts, share and turnover by class', () => {
      const rows = buildAbcRows(
        [
          makeItem({
            id: 'a1',
            name: 'A one',
            abcClass: 'Class A',
            current: '10',
            purchaseCost: '9',
          }),
          makeItem({
            id: 'a2',
            name: 'A two',
            abcClass: 'Class A',
            current: '0',
            purchaseCost: '9',
          }),
          makeItem({
            id: 'c1',
            name: 'C one',
            abcClass: 'Class C',
            current: '10',
            purchaseCost: '1',
          }),
        ],
        [
          makeTurnover({ itemId: 'a1', turnsPerYear: 9.2 }),
          makeTurnover({ name: 'C one', turnsPerYear: 1.3 }),
          makeTurnover({ itemId: 'junk', turnsPerYear: Number.NaN }), // skipped by the index
        ]
      );
      expect(rows.map((r) => r.label)).toEqual(['Class A', 'Class C']);
      const classA = rows[0];
      expect(classA.count).toBe(2);
      expect(classA.turns).toBeCloseTo(9.2);
      expect(Math.round(classA.sharePercent)).toBe(90); // 90 of 100 total value
      expect(rows[1].policy).toBe('Quarterly · trim');
    });
    it('degrades turns to null and share to 0 when unmatched / valueless', () => {
      const rows = buildAbcRows(
        [makeItem({ id: 'b1', abcClass: 'Class B', current: '0', purchaseCost: '0' })],
        []
      );
      expect(rows[0].turns).toBeNull();
      expect(rows[0].sharePercent).toBe(0);
    });
  });

  describe('isLowStock', () => {
    it('is true only when below a positive reorder point', () => {
      expect(isLowStock(makeItem({ current: '3', reorderLevel: '5' }))).toBe(true);
      expect(isLowStock(makeItem({ current: '8', reorderLevel: '5' }))).toBe(false);
      expect(isLowStock(makeItem({ current: '0', reorderLevel: '0' }))).toBe(false);
    });
  });

  describe('selectDefaultProduct', () => {
    it('returns null on empty', () => {
      expect(selectDefaultProduct([])).toBeNull();
    });
    it('prefers low stock, then class A, then first', () => {
      const low = makeItem({ id: 'low', current: '1', reorderLevel: '5' });
      const classA = makeItem({ id: 'a', current: '9', reorderLevel: '5', abcClass: 'Class A' });
      expect(selectDefaultProduct([classA, low])?.id).toBe('low');
      expect(
        selectDefaultProduct([makeItem({ id: 'x', current: '9', reorderLevel: '5' }), classA])?.id
      ).toBe('a');
      const first = makeItem({ id: 'first', current: '9', reorderLevel: '5' });
      expect(selectDefaultProduct([first])?.id).toBe('first');
    });
  });

  describe('computeSuggestedOrder', () => {
    it('uses reorder-up-to-2x, or null without a reorder point', () => {
      expect(computeSuggestedOrder(makeItem({ current: '12', reorderLevel: '40' }))).toBe(68);
      expect(computeSuggestedOrder(makeItem({ current: '100', reorderLevel: '40' }))).toBe(0);
      expect(computeSuggestedOrder(makeItem({ reorderLevel: '0' }))).toBeNull();
    });
  });

  describe('buildProductPanel', () => {
    it('binds real fields and pluralizes the unit', () => {
      const item = makeItem({
        id: 'p1',
        name: 'Carprofen 100 mg',
        subCategory: 'NSAID',
        form: 'Tablet',
        current: '12',
        reorderLevel: '40',
        abcClass: 'Class A',
        currency: 'EUR',
      });
      const panel = buildProductPanel(
        item,
        [makeTurnover({ itemId: 'p1', turnsPerYear: 11.4, daysOnShelf: 32 })],
        [item]
      );
      expect(panel.name).toBe('Carprofen 100 mg');
      expect(panel.subtitle).toBe('Class A · NSAID · tablets');
      expect(panel.isLowStock).toBe(true);
      expect(panel.turns).toBeCloseTo(11.4);
      expect(panel.daysOnShelf).toBe(32);
      expect(panel.onHand).toBe(12);
      expect(panel.reorderPoint).toBe(40);
      expect(panel.suggestedOrder).toBe(68);
      expect(panel.unit).toBe('tablets');
      expect(panel.currency).toBe('EUR');
    });
    it('degrades unmatched turnover and defaults the unit', () => {
      const item = makeItem({
        id: 'p2',
        name: 'Mystery',
        current: '9',
        reorderLevel: '5',
        form: undefined,
        subCategory: undefined,
        abcClass: undefined,
      });
      const panel = buildProductPanel(item, [], [item]);
      expect(panel.turns).toBeNull();
      expect(panel.daysOnShelf).toBeNull();
      expect(panel.unit).toBe('units');
      expect(panel.subtitle).toBe('units');
    });
    it('matches turnover by name when there is no id match', () => {
      const item = makeItem({
        id: 'no-id-match',
        name: 'Named Only',
        current: '5',
        reorderLevel: '2',
      });
      const panel = buildProductPanel(
        item,
        [makeTurnover({ name: 'Named Only', turnsPerYear: 7, daysOnShelf: 21 })],
        [item]
      );
      expect(panel.turns).toBe(7);
      expect(panel.daysOnShelf).toBe(21);
    });

    it('falls back to a generic name when the product has none', () => {
      const item = makeItem({ id: 'p9', current: '5', reorderLevel: '2' });
      (item as { basicInfo: { name?: string } }).basicInfo.name = undefined;
      const panel = buildProductPanel(item, [], [item]);
      expect(panel.name).toBe('Product');
    });

    it('keeps a units label that already ends in s', () => {
      const item = makeItem({
        id: 'p3',
        form: 'Wipes',
        subCategory: undefined,
        abcClass: undefined,
      });
      const panel = buildProductPanel(item, [], [item]);
      expect(panel.unit).toBe('wipes');
      expect(panel.subtitle).toBe('wipes');
    });
  });
});
