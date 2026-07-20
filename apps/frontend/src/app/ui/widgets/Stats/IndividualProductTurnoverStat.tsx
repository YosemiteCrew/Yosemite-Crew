import React from 'react';
import StatCardShell from '@/app/ui/widgets/Stats/StatCardShell';
import { useDashboardAnalytics } from '@/app/features/dashboard/hooks/useDashboardAnalytics';

const formatTurnoverValue = (value: number) => value.toFixed(1);

const IndividualProductTurnoverStat = () => {
  const analytics = useDashboardAnalytics('last_1_year');
  const options = analytics.durationOptions.individualProductTurnover;
  const products = analytics.productTurnover;
  const isEmpty = analytics.emptyState.individualProductTurnover;
  const visibleProducts = products.slice(0, 6);

  const maxValue = visibleProducts.reduce((max, product) => Math.max(max, product.turnover), 0);

  return (
    <StatCardShell title={'Product turnover'} options={options} isEmpty={isEmpty}>
      {visibleProducts.map((product) => {
        const widthPercentage = maxValue > 0 ? (product.turnover / maxValue) * 100 : 0;
        return (
          <div
            key={product.itemId}
            className="grid grid-cols-[minmax(0,120px)_1fr_48px] items-center gap-2.5"
          >
            <span className="truncate text-[12.5px] text-[var(--ink-muted)]">{product.name}</span>
            <div
              className="h-[13px] rounded-[4px] bg-[var(--cta)]"
              style={{ width: `${Math.max(0, Math.min(100, widthPercentage))}%` }}
            />
            <span className="text-right text-[12px] font-bold text-[var(--ink)] tabular-nums">
              {formatTurnoverValue(product.turnover)}
            </span>
          </div>
        );
      })}
    </StatCardShell>
  );
};

export default IndividualProductTurnoverStat;
