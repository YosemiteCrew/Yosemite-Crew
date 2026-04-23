import React, { useEffect, useState } from 'react';
import CardHeader from '@/app/ui/cards/CardHeader/CardHeader';
import DynamicChartCard from '@/app/ui/widgets/DynamicChart/DynamicChartCard';
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

  useEffect(() => {
    if (!durationOptions.includes(selectedDuration)) {
      setSelectedDuration(durationOptions[0] ?? 'Last week');
    }
  }, [durationOptions, selectedDuration]);

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
        keys={[{ name: 'Revenue', color: '#111' }]}
        yTickFormatter={(value) => formatMoney(value, currency)}
        yAxisWidth={48}
        barSize={16}
        xAxisLabel="Time"
        yAxisLabel="Revenue"
        compactMonthAxis={selectedDuration === 'Last month'}
      />
    </div>
  );
};

export default RevenueStat;
