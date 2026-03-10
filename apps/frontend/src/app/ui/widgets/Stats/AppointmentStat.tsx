import React, { useEffect, useState } from 'react';
import CardHeader from '@/app/ui/cards/CardHeader/CardHeader';
import DynamicChartCard from '@/app/ui/widgets/DynamicChart/DynamicChartCard';
import {
  DashboardDurationOption,
  mapDashboardDurationOption,
  useDashboardAnalytics,
} from '@/app/features/dashboard/hooks/useDashboardAnalytics';

const AppointmentStat = () => {
  const [selectedDuration, setSelectedDuration] = useState<DashboardDurationOption>('Last week');
  const analytics = useDashboardAnalytics(mapDashboardDurationOption(selectedDuration));
  const durationOptions = analytics.durationOptions.appointments;

  useEffect(() => {
    if (!durationOptions.includes(selectedDuration)) {
      setSelectedDuration(durationOptions[0] ?? 'Last week');
    }
  }, [durationOptions, selectedDuration]);

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
        keys={[
          { name: 'Completed', color: '#111' },
          { name: 'Cancelled', color: '#ccc' },
        ]}
        yAxisWidth={32}
        barSize={16}
        xAxisLabel="Time"
        yAxisLabel="Appointments"
      />
    </div>
  );
};

export default AppointmentStat;
