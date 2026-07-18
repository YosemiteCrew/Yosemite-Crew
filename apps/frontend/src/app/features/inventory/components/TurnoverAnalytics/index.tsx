'use client';
import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  IoBulbOutline,
  IoCartOutline,
  IoCubeOutline,
  IoTrendingDownOutline,
  IoTrendingUpOutline,
} from 'react-icons/io5';
import { useDashboardAnalytics } from '@/app/features/dashboard/hooks/useDashboardAnalytics';
import useIsPhone from '@/app/ui/layout/PhoneShell/useIsPhone';
import {
  InventoryItem,
  InventoryTurnoverItem,
} from '@/app/features/inventory/pages/Inventory/types';
import {
  AbcClass,
  AbcRow,
  MonthlyTurnover,
  ProductPanel,
  buildAbcRows,
  buildMonthlyTurnover,
  buildProductPanel,
  computeAnnualTurnover,
  computeAvgDaysOnShelf,
  computeExpiredWriteOff,
  computeStockValue,
  formatCurrency,
  formatTurns,
  isLowStock,
  selectDefaultProduct,
} from '@/app/features/inventory/components/TurnoverAnalytics/metrics';

type InventoryView = 'inventory' | 'turnover' | 'analytics';

type TurnoverAnalyticsProps = {
  turnover: InventoryTurnoverItem[];
  inventory: InventoryItem[];
  setActiveView: (view: InventoryView) => void;
  onReorder: (item: InventoryItem) => void;
};

const SEGMENTS: { key: InventoryView; label: string }[] = [
  { key: 'inventory', label: 'Stock' },
  { key: 'turnover', label: 'Orders' },
  { key: 'analytics', label: 'Turnover' },
];

const cardClass =
  'rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_1px_2px_var(--sh03)]';
const kpiCardClass = `${cardClass} flex flex-col gap-[3px] px-4 py-3.5`;
const kpiLabelClass = 'text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ink-faint)]';
const kpiValueClass = 'text-[22px] font-bold tracking-[-0.02em] tabular-nums text-[var(--ink)]';
const kpiCaptionClass = 'text-[11px] text-[var(--ink-faint)]';
const insetBoxClass = 'bg-[var(--inset)] border border-[var(--divider)]';

const abcTileClass: Record<AbcClass, string> = {
  'Class A': 'bg-[var(--blue)] text-white',
  'Class B': 'bg-[var(--blue-soft)] text-[var(--blue-text)]',
  'Class C': 'bg-[var(--inset)] text-[var(--ink-muted)] border border-[var(--divider)]',
};

const barHeight = (value: number | null, maxValue: number): number => {
  if (value === null || maxValue <= 0) return 0;
  return Math.max(4, Math.min(100, (value / maxValue) * 100));
};

const MiniKpi = ({ label, value, danger }: { label: string; value: string; danger?: boolean }) => (
  <span className={`${insetBoxClass} rounded-[12px] px-3 py-2.5`}>
    <span className="block text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
      {label}
    </span>
    <span
      className={clsx(
        'text-[16px] font-bold tabular-nums',
        danger ? 'text-[var(--danger-text)]' : 'text-[var(--ink)]'
      )}
    >
      {value}
    </span>
  </span>
);

const SubNav = ({ setActiveView }: { setActiveView: (view: InventoryView) => void }) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-[13px] text-[var(--ink-faint)]">
        Inventory / <span className="font-bold text-[var(--ink)]">Turnover</span>
      </span>
      <div
        className={`flex items-center gap-1 rounded-full p-1 ${insetBoxClass}`}
        role="tablist"
        aria-label="Inventory view"
      >
        {SEGMENTS.map((segment) => {
          const active = segment.key === 'analytics';
          return (
            <button
              key={segment.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveView(segment.key)}
              className={clsx(
                'rounded-full px-[13px] py-[5px] text-[12px] transition-colors',
                active
                  ? 'bg-[var(--screen)] font-bold text-[var(--ink)] shadow-[0_1px_3px_var(--sh08)]'
                  : 'font-semibold text-[var(--ink-muted)]'
              )}
            >
              {segment.label}
            </button>
          );
        })}
      </div>
    </div>
    <span className="rounded-full border border-[var(--hairline)] px-3.5 py-[7px] text-[12px] font-semibold text-[var(--ink-muted)]">
      2026 · year to date
    </span>
  </div>
);

type KpiCardsProps = {
  annualTurnover: number | null;
  annualDelta: number | null;
  previousYear: number | null;
  stockValue: number | null;
  currency: string;
  avgDaysOnShelf: number | null;
  expiredWriteOff: number | null;
  expiredShare: number | null;
};

const KpiCards = ({
  annualTurnover,
  annualDelta,
  previousYear,
  stockValue,
  currency,
  avgDaysOnShelf,
  expiredWriteOff,
  expiredShare,
}: KpiCardsProps) => (
  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
    <div className={kpiCardClass}>
      <span className={kpiLabelClass}>Annual turnover</span>
      <span className={kpiValueClass}>{formatTurns(annualTurnover)}</span>
      {annualDelta !== null ? (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--success-text)]">
          {annualDelta >= 0 ? (
            <IoTrendingUpOutline size={12} aria-hidden="true" />
          ) : (
            <IoTrendingDownOutline size={12} aria-hidden="true" />
          )}
          {annualDelta >= 0 ? '+' : ''}
          {annualDelta.toFixed(1)} vs {previousYear}
        </span>
      ) : (
        <span className={kpiCaptionClass}>year to date</span>
      )}
    </div>

    <div className={kpiCardClass}>
      <span className={kpiLabelClass}>Stock value</span>
      <span className={kpiValueClass}>{formatCurrency(stockValue, currency)}</span>
      <span className={kpiCaptionClass}>at cost · today</span>
    </div>

    <div className={kpiCardClass}>
      <span className={kpiLabelClass}>Avg days on shelf</span>
      <span className={kpiValueClass}>{avgDaysOnShelf ?? '—'}</span>
      <span className={kpiCaptionClass}>across tracked items</span>
    </div>

    <div className={kpiCardClass}>
      <span className={kpiLabelClass}>Expired write-off</span>
      <span className="text-[22px] font-bold tracking-[-0.02em] tabular-nums text-[var(--warn-text)]">
        {formatCurrency(expiredWriteOff, currency)}
      </span>
      <span className={kpiCaptionClass}>
        {expiredShare === null ? 'of stock value' : `${expiredShare.toFixed(1)}% of stock value`}
      </span>
    </div>
  </div>
);

const MonthChart = ({ monthly }: { monthly: MonthlyTurnover }) => (
  <div className={`${cardClass} flex flex-col gap-3 px-5 pb-3.5 pt-4`}>
    <div className="flex items-center justify-between">
      <span className="text-[14px] font-bold text-[var(--ink)]">Turnover by month</span>
      <span className="flex items-center gap-3 text-[11px] text-[var(--ink-faint)]">
        <span className="flex items-center gap-1.5">
          <span className="size-[9px] rounded-[3px] bg-[var(--blue)]" />
          {monthly.currentYear ?? '2026'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`size-[9px] rounded-[3px] ${insetBoxClass}`} />
          {monthly.previousYear ?? '2025'}
        </span>
      </span>
    </div>
    {monthly.hasData ? (
      <div className="flex h-[150px] items-end gap-2.5 overflow-x-auto">
        {monthly.bars.map((bar) => (
          <div
            key={bar.month}
            className="flex h-full min-w-[26px] flex-1 flex-col items-center justify-end gap-1.5"
          >
            <div className="flex h-full w-full items-end gap-[3px]">
              <span
                className="flex-1 rounded-t-md bg-[var(--blue)]"
                style={{
                  height: `${barHeight(bar.currentValue, monthly.maxValue)}%`,
                  opacity: bar.highlight ? 0.55 : 1,
                }}
              />
              <span
                className={`flex-1 rounded-t-md ${insetBoxClass}`}
                style={{ height: `${barHeight(bar.previousValue, monthly.maxValue)}%` }}
              />
            </div>
            <span
              className={clsx(
                'text-[10px] font-semibold',
                bar.highlight ? 'text-[var(--blue-text)]' : 'text-[var(--ink-faint)]'
              )}
            >
              {bar.month}
            </span>
          </div>
        ))}
      </div>
    ) : (
      <div className="flex h-[150px] items-center justify-center text-[12px] text-[var(--ink-faint)]">
        Not enough history yet
      </div>
    )}
  </div>
);

type AbcTableProps = {
  rows: AbcRow[];
  onSelectClass: (label: AbcClass) => void;
};

const AbcTable = ({ rows, onSelectClass }: AbcTableProps) => (
  <div className={`${cardClass} flex flex-col overflow-hidden`}>
    <div className="flex items-center justify-between border-b border-[var(--hairline)] px-[18px] pb-2.5 pt-3">
      <span className="text-[14px] font-bold text-[var(--ink)]">ABC classification</span>
      <span className="text-[11px] text-[var(--ink-faint)]">by consumption value · YTD</span>
    </div>
    {rows.length === 0 ? (
      <div className="px-[18px] py-6 text-center text-[12px] text-[var(--ink-faint)]">
        No ABC-classified products yet
      </div>
    ) : (
      rows.map((row) => (
        <button
          key={row.label}
          type="button"
          onClick={() => onSelectClass(row.label)}
          className="grid grid-cols-[44px_1fr_auto] items-center gap-3 border-t border-[var(--hairline)] px-[18px] py-2.5 text-left text-[12.5px] transition-colors hover:bg-[var(--inset)] sm:grid-cols-[64px_1fr_120px_110px_110px]"
        >
          <span
            className={`flex size-[30px] items-center justify-center rounded-[9px] font-extrabold ${abcTileClass[row.label]}`}
          >
            {row.label.replace('Class ', '')}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-[7px] flex-1 overflow-hidden rounded-full bg-[var(--inset)]">
              <span
                className="block h-full bg-[var(--blue)]"
                style={{ width: `${Math.min(100, row.sharePercent)}%` }}
              />
            </span>
            <span className="font-bold tabular-nums text-[var(--ink)]">
              {Math.round(row.sharePercent)}%
            </span>
          </span>
          <span className="tabular-nums text-[var(--ink-muted)]">{row.count} products</span>
          <span className="hidden font-bold tabular-nums text-[var(--ink)] sm:block">
            {formatTurns(row.turns)}
          </span>
          <span className="hidden text-[11.5px] text-[var(--ink-muted)] sm:block">
            {row.policy}
          </span>
        </button>
      ))
    )}
  </div>
);

type ProductPanelProps = {
  panel: ProductPanel;
  reorderLabel: string;
  onReorder: () => void;
};

const ProductDetailPanel = ({ panel, reorderLabel, onReorder }: ProductPanelProps) => (
  <div
    className={`${cardClass} flex w-full flex-col overflow-hidden xl:max-w-[380px] xl:flex-1`}
    data-testid="product-panel"
  >
    <div className="flex items-center justify-between border-b border-[var(--hairline)] px-[18px] pb-3 pt-3.5">
      <span className="flex flex-col gap-0.5">
        <span className="text-[14px] font-bold text-[var(--ink)]">{panel.name}</span>
        <span className="text-[11px] text-[var(--ink-faint)]">{panel.subtitle}</span>
      </span>
      {panel.isLowStock && (
        <span className="inline-flex items-center rounded-full border border-[var(--danger-border)] bg-[var(--danger-bg)] px-2.5 py-[3px] text-[9.5px] font-bold text-[var(--danger-text)]">
          LOW STOCK
        </span>
      )}
    </div>
    <div className="flex flex-col gap-3 px-[18px] py-3.5">
      <div className="grid grid-cols-2 gap-2.5">
        <MiniKpi label="Turnover" value={formatTurns(panel.turns)} />
        <MiniKpi
          label="Days on shelf"
          value={panel.daysOnShelf === null ? '—' : String(panel.daysOnShelf)}
        />
        <MiniKpi label="On hand" value={String(panel.onHand)} danger={panel.isLowStock} />
        <MiniKpi label="Reorder point" value={String(panel.reorderPoint)} />
      </div>
      <div className="flex flex-col gap-[7px]">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
          Consumption · last 6 months
        </span>
        <div className="flex h-16 items-center justify-center rounded-[10px] border border-dashed border-[var(--divider)] text-[11px] text-[var(--ink-faint)]">
          No consumption history yet
        </div>
      </div>
      {panel.suggestedOrder != null && (
        <div className={`flex gap-2.5 rounded-[12px] p-3 ${insetBoxClass}`}>
          <IoBulbOutline
            size={15}
            className="mt-px shrink-0 text-[var(--blue-text)]"
            aria-hidden="true"
          />
          <span className="text-[11.5px] leading-[1.55] text-[var(--ink-body)]">
            Suggested order:{' '}
            <strong className="text-[var(--ink)]">
              {panel.suggestedOrder} {panel.unit}
            </strong>{' '}
            brings stock to twice the reorder point of {panel.reorderPoint}.
          </span>
        </div>
      )}
    </div>
    <div className="mt-auto flex gap-2.5 border-t border-[var(--hairline)] px-[18px] pb-4 pt-3">
      <button
        type="button"
        onClick={onReorder}
        className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--cta)] text-[12.5px] font-semibold text-[var(--cta-text)]"
      >
        <IoCartOutline size={14} aria-hidden="true" />
        {reorderLabel}
      </button>
    </div>
  </div>
);

const ProductPhoneCard = ({ panel, reorderLabel, onReorder }: ProductPanelProps) => (
  <div
    className={`${cardClass} flex items-center gap-2.5 px-3 py-3`}
    data-testid="product-card-phone"
  >
    <span
      className={clsx(
        'flex size-[34px] shrink-0 items-center justify-center rounded-[10px]',
        panel.isLowStock
          ? 'bg-[var(--danger-bg)] text-[var(--danger-text)]'
          : 'bg-[var(--inset)] text-[var(--ink-muted)]'
      )}
    >
      <IoCubeOutline size={15} aria-hidden="true" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[12px] font-bold text-[var(--ink)]">
        {panel.name} · {formatTurns(panel.turns)}
      </span>
      <span className="block text-[10px] text-[var(--ink-faint)]">
        {panel.onHand} on hand · {panel.isLowStock ? 'below ' : ''}reorder point{' '}
        {panel.reorderPoint}
      </span>
    </span>
    <button
      type="button"
      onClick={onReorder}
      className="flex h-8 shrink-0 items-center justify-center rounded-full bg-[var(--cta)] px-3 text-[10.5px] font-semibold text-[var(--cta-text)]"
    >
      {reorderLabel}
    </button>
  </div>
);

const TurnoverAnalytics = ({
  turnover,
  inventory,
  setActiveView,
  onReorder,
}: TurnoverAnalyticsProps) => {
  const analytics = useDashboardAnalytics('last_1_year');
  const isPhone = useIsPhone();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const currency = useMemo(() => {
    const withCurrency = inventory.find((item) => Boolean(item.currency));
    return withCurrency?.currency ?? 'EUR';
  }, [inventory]);

  const annualTurnover = useMemo(
    () => computeAnnualTurnover(analytics.inventoryTurnover.turnsPerYear, turnover),
    [analytics.inventoryTurnover.turnsPerYear, turnover]
  );
  const stockValue = useMemo(() => computeStockValue(inventory), [inventory]);
  const avgDaysOnShelf = useMemo(() => computeAvgDaysOnShelf(turnover), [turnover]);
  const expiredWriteOff = useMemo(() => computeExpiredWriteOff(inventory), [inventory]);
  const monthly = useMemo(
    () => buildMonthlyTurnover(analytics.inventoryTurnover.trend),
    [analytics.inventoryTurnover.trend]
  );
  const abcRows = useMemo(() => buildAbcRows(inventory, turnover), [inventory, turnover]);

  const annualDelta = useMemo(() => {
    const current = monthly.bars
      .map((bar) => bar.currentValue)
      .filter((value): value is number => value !== null);
    const previous = monthly.bars
      .map((bar) => bar.previousValue)
      .filter((value): value is number => value !== null);
    if (current.length === 0 || previous.length === 0) return null;
    const avg = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
    return avg(current) - avg(previous);
  }, [monthly.bars]);

  const expiredShare =
    expiredWriteOff !== null && stockValue !== null && stockValue > 0
      ? (expiredWriteOff / stockValue) * 100
      : null;

  const defaultProduct = useMemo(() => selectDefaultProduct(inventory), [inventory]);
  const selectedProduct = useMemo(() => {
    if (selectedId) {
      return inventory.find((item) => item.id === selectedId) ?? defaultProduct;
    }
    return defaultProduct;
  }, [selectedId, inventory, defaultProduct]);

  const panel = useMemo(
    () => (selectedProduct ? buildProductPanel(selectedProduct, turnover, inventory) : null),
    [selectedProduct, turnover, inventory]
  );

  const handleSelectClass = (label: AbcClass) => {
    const inClass = inventory.filter((item) => item.stock?.abcClass === label);
    if (inClass.length === 0) return;
    const target = inClass.find((item) => isLowStock(item)) ?? inClass[0];
    setSelectedId(target.id ?? null);
  };

  const handleReorder = () => {
    if (selectedProduct) onReorder(selectedProduct);
  };

  const reorderLabel =
    panel?.suggestedOrder != null ? `Reorder ${panel.suggestedOrder}` : 'Reorder';

  return (
    <div className="flex flex-col gap-4">
      <SubNav setActiveView={setActiveView} />

      <KpiCards
        annualTurnover={annualTurnover}
        annualDelta={annualDelta}
        previousYear={monthly.previousYear}
        stockValue={stockValue}
        currency={currency}
        avgDaysOnShelf={avgDaysOnShelf}
        expiredWriteOff={expiredWriteOff}
        expiredShare={expiredShare}
      />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
        <div className="flex min-w-0 flex-col gap-4 xl:flex-[1.5]">
          <MonthChart monthly={monthly} />
          <AbcTable rows={abcRows} onSelectClass={handleSelectClass} />
        </div>

        {panel && !isPhone && (
          <ProductDetailPanel panel={panel} reorderLabel={reorderLabel} onReorder={handleReorder} />
        )}
      </div>

      {panel && isPhone && (
        <ProductPhoneCard panel={panel} reorderLabel={reorderLabel} onReorder={handleReorder} />
      )}
    </div>
  );
};

export default TurnoverAnalytics;
