import React, { useState } from 'react';
import StatCardShell from '@/app/ui/widgets/Stats/StatCardShell';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { formatMoney } from '@/app/lib/money';
import {
  DashboardDurationOption,
  mapDashboardDurationOption,
  useDashboardAnalytics,
} from '@/app/features/dashboard/hooks/useDashboardAnalytics';

// Rank flourish from the design: bars fade as they descend the leaderboard.
const rankOpacity = (index: number) => {
  if (index === 0) return 1;
  if (index === 1) return 0.82;
  if (index === 2) return 0.64;
  return 0.5;
};

const RevenueLeadersStat = () => {
  const [selectedDuration, setSelectedDuration] = useState<DashboardDurationOption>('Last week');
  const currency = useCurrencyForPrimaryOrg();
  const analytics = useDashboardAnalytics(mapDashboardDurationOption(selectedDuration));
  const durationOptions = analytics.durationOptions.revenueLeaders;
  const leaders = analytics.revenueLeaders;

  const effectiveDuration = durationOptions.includes(selectedDuration)
    ? selectedDuration
    : (durationOptions[0] ?? 'Last week');
  if (effectiveDuration !== selectedDuration) setSelectedDuration(effectiveDuration);

  const isEmpty = analytics.emptyState.revenueLeaders;
  const maxRevenue = leaders.reduce((max, leader) => Math.max(max, leader.revenue), 0);

  return (
    <StatCardShell
      title="Revenue leaders"
      options={durationOptions}
      selected={selectedDuration}
      onSelect={(next) => setSelectedDuration(next as DashboardDurationOption)}
      isEmpty={isEmpty}
      cardClassName={`gap-3.5 overflow-hidden ${isEmpty ? 'min-h-89' : ''}`}
    >
      <div className="flex flex-col gap-2.5">
        {leaders.map((leader, index) => {
          const width = maxRevenue > 0 ? (leader.revenue / maxRevenue) * 100 : 0;
          return (
            <div
              key={`${leader.label}-${index + 1}`}
              className="grid grid-cols-[minmax(0,130px)_1fr_56px] items-center gap-2.5"
            >
              <span className="truncate text-[12.5px] font-semibold text-[var(--ink-body)]">
                {leader.label}
              </span>
              <div
                className="h-3.5 rounded-[4px] bg-[var(--blue)]"
                style={{
                  width: `${Math.max(0, Math.min(100, width))}%`,
                  opacity: rankOpacity(index),
                }}
              />
              <span className="text-right text-[12px] font-bold text-[var(--ink)] tabular-nums">
                {formatMoney(leader.revenue, currency)}
              </span>
            </div>
          );
        })}
      </div>
    </StatCardShell>
  );
};

export default RevenueLeadersStat;
