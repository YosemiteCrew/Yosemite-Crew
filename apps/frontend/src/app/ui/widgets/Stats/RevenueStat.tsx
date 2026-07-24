import React, { useState } from 'react';
import CardHeader from '@/app/ui/cards/CardHeader/CardHeader';
import dynamic from 'next/dynamic';
const DynamicChartCard = dynamic(() => import('@/app/ui/widgets/DynamicChart/DynamicChartCard'), {
  ssr: false,
});
import {
  DashboardDurationOption,
  mapDashboardDurationOption,
  useDashboardAnalytics,
} from '@/app/features/dashboard/hooks/useDashboardAnalytics';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { formatMoney } from '@/app/lib/money';

const RevenueStat = () => {
  const [selectedDuration, setSelectedDuration] = useState<DashboardDurationOption>('Last week');
  const currency = useCurrencyForPrimaryOrg();
  const analytics = useDashboardAnalytics(mapDashboardDurationOption(selectedDuration));
  const durationOptions = analytics.durationOptions.revenue;
  const effectiveDuration = durationOptions.includes(selectedDuration)
    ? selectedDuration
    : (durationOptions[0] ?? 'Last week');
  if (effectiveDuration !== selectedDuration) setSelectedDuration(effectiveDuration);

  /* The design surfaces the period total in success green beside the card title.
     There is no period-over-period delta in the analytics payload, so only the
     total is shown. */
  const periodTotal = analytics.charts.revenue.reduce((sum, point) => sum + point.Revenue, 0);

  return (
    <div className="flex flex-col gap-2">
      <CardHeader
        title={'Revenue'}
        options={durationOptions}
        selected={selectedDuration}
        onSelect={(next) => setSelectedDuration(next as DashboardDurationOption)}
      />
      <DynamicChartCard
        data={analytics.charts.revenue}
        isEmpty={analytics.emptyState.revenueChart}
        keys={[{ name: 'Revenue', color: 'var(--blue)' }]}
        hideKeys
        yTickFormatter={(value) => formatMoney(value, currency)}
        chartHeight={150}
        hideYAxis
        barSize={22}
        compactMonthAxis={selectedDuration === 'Last month'}
        headerContent={
          periodTotal > 0 ? (
            <div className="flex w-full justify-end">
              <span className="text-[12px] font-semibold text-[var(--success)]">
                {formatMoney(periodTotal, currency)}
              </span>
            </div>
          ) : null
        }
      />
    </div>
  );
};

export default RevenueStat;
