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

const AppointmentStat = () => {
  const [selectedDuration, setSelectedDuration] = useState<DashboardDurationOption>('Last week');
  const analytics = useDashboardAnalytics(mapDashboardDurationOption(selectedDuration));
  const durationOptions = analytics.durationOptions.appointments;
  const effectiveDuration = durationOptions.includes(selectedDuration)
    ? selectedDuration
    : (durationOptions[0] ?? 'Last week');
  if (effectiveDuration !== selectedDuration) setSelectedDuration(effectiveDuration);

  return (
    <div className="flex flex-col gap-2">
      <CardHeader
        title={'Appointments'}
        options={durationOptions}
        selected={selectedDuration}
        onSelect={(next) => setSelectedDuration(next as DashboardDurationOption)}
      />
      <DynamicChartCard
        data={analytics.charts.appointments}
        isEmpty={analytics.emptyState.appointmentsChart}
        keys={[
          { name: 'Completed', color: 'var(--cta)' },
          { name: 'Cancelled', color: 'var(--divider)' },
        ]}
        yAxisWidth={32}
        barSize={16}
        xAxisLabel="Time"
        yAxisLabel="Appointments"
        compactMonthAxis={selectedDuration === 'Last month'}
      />
    </div>
  );
};

export default AppointmentStat;
