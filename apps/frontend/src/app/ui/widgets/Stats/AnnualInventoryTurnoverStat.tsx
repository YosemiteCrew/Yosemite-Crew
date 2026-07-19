import React from 'react';
import StatCardShell from '@/app/ui/widgets/Stats/StatCardShell';
import { useDashboardAnalytics } from '@/app/features/dashboard/hooks/useDashboardAnalytics';

const AnnualInventoryTurnoverStat = () => {
  const analytics = useDashboardAnalytics('last_1_year');
  const options = analytics.durationOptions.annualInventoryTurnover;
  const isEmpty = analytics.emptyState.annualInventoryTurnover;
  const trend = analytics.inventoryTurnover.trend;

  const maxTurnover = trend.reduce((max, point) => Math.max(max, point.turnover), 0);
  const lastIndex = trend.length - 1;

  return (
    <StatCardShell title={'Annual inventory turnover'} options={options} isEmpty={isEmpty}>
      <div className="flex h-30 flex-1 items-end gap-2.5 px-1">
        {trend.map((point, index) => {
          const heightPct = maxTurnover > 0 ? (point.turnover / maxTurnover) * 100 : 0;
          const isPartial = index === lastIndex;
          const isPeak = point.turnover === maxTurnover && maxTurnover > 0;
          return (
            <div
              key={`${point.month}-${point.year}-${index + 1}`}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            >
              <div
                className="w-full max-w-[34px]"
                style={{
                  height: `${Math.max(0, Math.min(100, heightPct))}%`,
                  background: isPartial ? 'var(--divider)' : 'var(--cta)',
                  opacity: isPartial || isPeak ? 1 : 0.85,
                  borderRadius: '5px 5px 2px 2px',
                }}
              />
              <span className="text-[10px] text-[var(--ink-faint)]">{point.month}</span>
            </div>
          );
        })}
      </div>
    </StatCardShell>
  );
};

export default AnnualInventoryTurnoverStat;
