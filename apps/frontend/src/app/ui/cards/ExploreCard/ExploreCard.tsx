'use client';
import React, { useState } from 'react';
import CardHeader from '@/app/ui/cards/CardHeader/CardHeader';

import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { formatMoney } from '@/app/lib/money';
import {
  DashboardDurationOption,
  mapDashboardDurationOption,
  useDashboardAnalytics,
} from '@/app/features/dashboard/hooks/useDashboardAnalytics';

const getExploreStats = (
  metrics: { revenue: number; appointments: number; tasks: number; staffOnDuty: number },
  currency: string
) => [
  {
    name: 'Revenue',
    value: formatMoney(metrics.revenue, currency),
  },
  {
    name: 'Appointments',
    value: metrics.appointments.toString(),
  },
  {
    name: 'Tasks',
    value: metrics.tasks.toString(),
  },
  {
    name: 'Staff on duty',
    value: metrics.staffOnDuty.toString(),
  },
];

const Explorecard = () => {
  const [selectedDuration, setSelectedDuration] = useState<DashboardDurationOption>('Last week');
  const analytics = useDashboardAnalytics(mapDashboardDurationOption(selectedDuration));
  const currency = useCurrencyForPrimaryOrg();
  const durationOptions = analytics.durationOptions.explore;
  const effectiveDuration = durationOptions.includes(selectedDuration)
    ? selectedDuration
    : (durationOptions[0] ?? 'Last week');
  const stats = getExploreStats(analytics.explore, currency);

  return (
    <div className="flex flex-col w-full gap-3">
      <CardHeader
        title={'Explore'}
        options={durationOptions}
        selected={effectiveDuration}
        onSelect={(next) => setSelectedDuration(next as DashboardDurationOption)}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div
            className="yc-card-elevated p-3 w-full rounded-2xl border border-card-border bg-neutral-0 flex flex-col gap-1"
            key={stat.name}
          >
            <div className="text-[12.5px] text-[var(--ink-faint)]">{stat.name}</div>
            <p className="text-[24px] font-bold tracking-[-0.03em] tabular-nums text-[var(--ink)]">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Explorecard;
