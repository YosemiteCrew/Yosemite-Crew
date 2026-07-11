import {
  InventoryItem,
  InventoryTurnoverItem,
} from '@/app/features/inventory/pages/Inventory/types';

export type InventoryTurnoverTrendPoint = {
  month: string;
  year: number;
  turnover: number;
};

export const ABC_CLASSES = ['Class A', 'Class B', 'Class C'] as const;
export type AbcClass = (typeof ABC_CLASSES)[number];

export const ABC_POLICY: Record<AbcClass, string> = {
  'Class A': 'Weekly review',
  'Class B': 'Monthly review',
  'Class C': 'Quarterly · trim',
};

/** Parse a value that may be a number or a numeric string; NaN/undefined → 0. */
export const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const getOnHand = (item: InventoryItem): number => toNumber(item.stock?.current);
export const getReorderPoint = (item: InventoryItem): number => toNumber(item.stock?.reorderLevel);
export const getUnitCost = (item: InventoryItem): number => toNumber(item.pricing?.purchaseCost);

export const getCurrency = (inventory: InventoryItem[]): string => {
  const withCurrency = inventory.find((item) => Boolean(item.currency));
  return withCurrency?.currency ?? 'EUR';
};

export const formatCurrency = (value: number | null, currency = 'EUR'): string => {
  if (value === null) return '—';
  try {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value)}`;
  }
};

export const formatTurns = (value: number | null): string =>
  value === null ? '—' : `${value.toFixed(1)}×`;

/** Total value of stock on hand, at cost. Null when there is nothing to value. */
export const computeStockValue = (inventory: InventoryItem[]): number | null => {
  if (inventory.length === 0) return null;
  return inventory.reduce((sum, item) => sum + getOnHand(item) * getUnitCost(item), 0);
};

/** Average days-on-shelf across turnover rows that report it. Null when none do. */
export const computeAvgDaysOnShelf = (turnover: InventoryTurnoverItem[]): number | null => {
  const values = turnover
    .map((item) => item.daysOnShelf)
    .filter((days): days is number => typeof days === 'number' && Number.isFinite(days));
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, days) => sum + days, 0) / values.length);
};

/** Blended annual turnover. Prefers the org figure, falls back to the row average. */
export const computeAnnualTurnover = (
  annualTurnsPerYear: number,
  turnover: InventoryTurnoverItem[]
): number | null => {
  if (annualTurnsPerYear > 0) return annualTurnsPerYear;
  const values = turnover
    .map((item) => item.turnsPerYear)
    .filter((turns): turns is number => typeof turns === 'number' && Number.isFinite(turns));
  if (values.length === 0) return null;
  return values.reduce((sum, turns) => sum + turns, 0) / values.length;
};

/** Value of stock whose batches have already expired. Null when no inventory. */
export const computeExpiredWriteOff = (
  inventory: InventoryItem[],
  referenceDate: Date = new Date()
): number | null => {
  if (inventory.length === 0) return null;
  const reference = referenceDate.getTime();
  return inventory.reduce((sum, item) => {
    const unitCost = getUnitCost(item);
    const batches = item.batches ?? [];
    const expiredValue = batches.reduce((batchSum, batch) => {
      if (!batch.expiryDate) return batchSum;
      const expiry = new Date(batch.expiryDate).getTime();
      if (Number.isNaN(expiry) || expiry >= reference) return batchSum;
      return batchSum + toNumber(batch.quantity) * unitCost;
    }, 0);
    return sum + expiredValue;
  }, 0);
};

export type MonthlyTurnoverBar = {
  month: string;
  currentValue: number | null;
  previousValue: number | null;
  highlight: boolean;
};

export type MonthlyTurnover = {
  bars: MonthlyTurnoverBar[];
  maxValue: number;
  currentYear: number | null;
  previousYear: number | null;
  hasData: boolean;
};

/** Group a turnover trend into current-vs-previous-year monthly bars. */
export const buildMonthlyTurnover = (trend: InventoryTurnoverTrendPoint[]): MonthlyTurnover => {
  if (trend.length === 0) {
    return { bars: [], maxValue: 0, currentYear: null, previousYear: null, hasData: false };
  }
  const currentYear = trend.reduce((max, point) => Math.max(max, point.year), trend[0].year);
  const previousYear = currentYear - 1;

  const monthOrder: string[] = [];
  const currentByMonth = new Map<string, number>();
  const previousByMonth = new Map<string, number>();

  trend.forEach((point) => {
    if (point.year === currentYear) {
      if (!monthOrder.includes(point.month)) monthOrder.push(point.month);
      currentByMonth.set(point.month, point.turnover);
    } else if (point.year === previousYear) {
      previousByMonth.set(point.month, point.turnover);
    }
  });

  // Months only present in the previous year still deserve a slot.
  previousByMonth.forEach((_value, month) => {
    if (!monthOrder.includes(month)) monthOrder.push(month);
  });

  const maxValue = trend.reduce((max, point) => Math.max(max, point.turnover), 0);

  const bars: MonthlyTurnoverBar[] = monthOrder.map((month, index) => ({
    month,
    currentValue: currentByMonth.has(month) ? (currentByMonth.get(month) as number) : null,
    previousValue: previousByMonth.has(month) ? (previousByMonth.get(month) as number) : null,
    highlight: index === monthOrder.length - 1,
  }));

  return { bars, maxValue, currentYear, previousYear, hasData: bars.length > 0 };
};

export type AbcRow = {
  label: AbcClass;
  count: number;
  sharePercent: number;
  turns: number | null;
  policy: string;
};

const buildTurnsIndex = (turnover: InventoryTurnoverItem[]) => {
  const byName = new Map<string, number>();
  const byId = new Map<string, number>();
  turnover.forEach((item) => {
    if (typeof item.turnsPerYear !== 'number' || !Number.isFinite(item.turnsPerYear)) return;
    if (item.name) byName.set(item.name.trim().toLowerCase(), item.turnsPerYear);
    if (item.itemId) byId.set(item.itemId, item.turnsPerYear);
  });
  return { byName, byId };
};

const matchTurns = (
  item: InventoryItem,
  index: { byName: Map<string, number>; byId: Map<string, number> }
): number | undefined => {
  if (item.id && index.byId.has(item.id)) return index.byId.get(item.id);
  const name = item.basicInfo?.name?.trim().toLowerCase();
  if (name && index.byName.has(name)) return index.byName.get(name);
  return undefined;
};

/** ABC rows bound to real abcClass membership, stock value share and turnover. */
export const buildAbcRows = (
  inventory: InventoryItem[],
  turnover: InventoryTurnoverItem[]
): AbcRow[] => {
  const turnsIndex = buildTurnsIndex(turnover);
  const aggregates = new Map<
    AbcClass,
    { count: number; value: number; turnsSum: number; turnsCount: number }
  >();

  inventory.forEach((item) => {
    const abcClass = item.stock?.abcClass as AbcClass | undefined;
    if (!abcClass || !ABC_CLASSES.includes(abcClass)) return;
    const current = aggregates.get(abcClass) ?? { count: 0, value: 0, turnsSum: 0, turnsCount: 0 };
    current.count += 1;
    current.value += getOnHand(item) * getUnitCost(item);
    const turns = matchTurns(item, turnsIndex);
    if (typeof turns === 'number') {
      current.turnsSum += turns;
      current.turnsCount += 1;
    }
    aggregates.set(abcClass, current);
  });

  const totalValue = Array.from(aggregates.values()).reduce((sum, agg) => sum + agg.value, 0);

  return ABC_CLASSES.filter((label) => aggregates.has(label)).map((label) => {
    const agg = aggregates.get(label) as {
      count: number;
      value: number;
      turnsSum: number;
      turnsCount: number;
    };
    return {
      label,
      count: agg.count,
      sharePercent: totalValue > 0 ? (agg.value / totalValue) * 100 : 0,
      turns: agg.turnsCount > 0 ? agg.turnsSum / agg.turnsCount : null,
      policy: ABC_POLICY[label],
    };
  });
};

export const isLowStock = (item: InventoryItem): boolean => {
  const reorder = getReorderPoint(item);
  return reorder > 0 && getOnHand(item) < reorder;
};

/** Pick a representative product for the panel: prefer a low-stock item, then Class A. */
export const selectDefaultProduct = (inventory: InventoryItem[]): InventoryItem | null => {
  if (inventory.length === 0) return null;
  const lowStock = inventory.find((item) => isLowStock(item));
  if (lowStock) return lowStock;
  const classA = inventory.find((item) => item.stock?.abcClass === 'Class A');
  return classA ?? inventory[0];
};

const pluralizeUnit = (form?: string): string => {
  const trimmed = (form ?? '').trim();
  if (!trimmed) return 'units';
  const lower = trimmed.toLowerCase();
  return lower.endsWith('s') ? lower : `${lower}s`;
};

/** Reorder-up-to-2× heuristic. Null when there is no reorder point to work from. */
export const computeSuggestedOrder = (item: InventoryItem): number | null => {
  const reorder = getReorderPoint(item);
  if (reorder <= 0) return null;
  return Math.max(reorder * 2 - getOnHand(item), 0);
};

export type ProductPanel = {
  name: string;
  subtitle: string;
  isLowStock: boolean;
  turns: number | null;
  daysOnShelf: number | null;
  onHand: number;
  reorderPoint: number;
  suggestedOrder: number | null;
  unit: string;
  currency: string;
};

export const buildProductPanel = (
  item: InventoryItem,
  turnover: InventoryTurnoverItem[],
  inventory: InventoryItem[]
): ProductPanel => {
  const turnsIndex = buildTurnsIndex(turnover);
  const turns = matchTurns(item, turnsIndex) ?? null;
  const matchedTurnover =
    turnover.find((row) => row.itemId && row.itemId === item.id) ??
    turnover.find(
      (row) => row.name?.trim().toLowerCase() === item.basicInfo?.name?.trim().toLowerCase()
    );
  const daysOnShelf =
    typeof matchedTurnover?.daysOnShelf === 'number' ? matchedTurnover.daysOnShelf : null;
  const unit = pluralizeUnit(item.classification?.form);
  const subtitle = [item.stock?.abcClass, item.basicInfo?.subCategory, unit]
    .filter((part): part is string => Boolean(part))
    .join(' · ');

  return {
    name: item.basicInfo?.name ?? 'Product',
    subtitle,
    isLowStock: isLowStock(item),
    turns,
    daysOnShelf,
    onHand: getOnHand(item),
    reorderPoint: getReorderPoint(item),
    suggestedOrder: computeSuggestedOrder(item),
    unit,
    currency: getCurrency(inventory),
  };
};
