import React from 'react';
import { IoTrendingUpOutline } from 'react-icons/io5';
import StatCardShell from '@/app/ui/widgets/Stats/StatCardShell';
import { useDashboardAnalytics } from '@/app/features/dashboard/hooks/useDashboardAnalytics';

const formatTurnoverValue = (value: number) => value.toFixed(1);

/* The design breaks a single product into Received / Dispensed / On shelf and gives
   each row its own bar colour. This card lists several products instead, so the same
   three colours cycle down the rows to keep the multi-hue reading of the design. */
const BAR_COLORS = ['var(--cta)', 'var(--blue)', 'var(--divider)'];

const buildTurnoverInsight = (turnsPerYear: number, targetTurnsPerYear: number) => {
  const headline = `Turned over ${formatTurnoverValue(turnsPerYear)}× this year`;
  if (targetTurnsPerYear <= 0) return headline;
  const comparison = turnsPerYear >= targetTurnsPerYear ? 'above' : 'below';
  return `${headline} · ${comparison} the ${formatTurnoverValue(targetTurnsPerYear)} clinic average`;
};

const IndividualProductTurnoverStat = () => {
  const analytics = useDashboardAnalytics('last_1_year');
  const options = analytics.durationOptions.individualProductTurnover;
  const products = analytics.productTurnover;
  const isEmpty = analytics.emptyState.individualProductTurnover;
  const visibleProducts = products.slice(0, 6);
  const { turnsPerYear, targetTurnsPerYear } = analytics.inventoryTurnover;

  const maxValue = visibleProducts.reduce((max, product) => Math.max(max, product.turnover), 0);

  return (
    <StatCardShell title={'Product turnover'} options={options} isEmpty={isEmpty}>
      {visibleProducts.map((product, index) => {
        const widthPercentage = maxValue > 0 ? (product.turnover / maxValue) * 100 : 0;
        return (
          <div
            key={product.itemId}
            className="grid grid-cols-[minmax(0,96px)_1fr_60px] items-center gap-2.5"
          >
            <span className="truncate text-[12.5px] text-[var(--ink-muted)]">{product.name}</span>
            <div
              className="h-[13px] rounded-[4px]"
              style={{
                width: `${Math.max(0, Math.min(100, widthPercentage))}%`,
                background: BAR_COLORS[index % BAR_COLORS.length],
              }}
            />
            <span className="text-right text-[12px] font-bold text-[var(--ink)] tabular-nums">
              {formatTurnoverValue(product.turnover)}
            </span>
          </div>
        );
      })}
      {turnsPerYear > 0 && (
        <div className="mt-1.5 flex items-center gap-2 rounded-[11px] bg-[var(--inset)] px-3 py-[9px] text-[12px] text-[var(--ink-muted)]">
          <IoTrendingUpOutline
            color="var(--success)"
            size={14}
            className="shrink-0"
            aria-hidden="true"
          />
          <span>{buildTurnoverInsight(turnsPerYear, targetTurnsPerYear)}</span>
        </div>
      )}
    </StatCardShell>
  );
};

export default IndividualProductTurnoverStat;
