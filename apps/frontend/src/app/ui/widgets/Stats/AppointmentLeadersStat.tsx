import React, { useEffect, useMemo, useState } from 'react';
import CardHeader from '@/app/ui/cards/CardHeader/CardHeader';
import DynamicChartCard from '@/app/ui/widgets/DynamicChart/DynamicChartCard';
import {
  DashboardDurationOption,
  mapDashboardDurationOption,
  useDashboardAnalytics,
} from '@/app/features/dashboard/hooks/useDashboardAnalytics';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';

const AppointmentLeadersStat = () => {
  const [selectedDuration, setSelectedDuration] = useState<DashboardDurationOption>('Last week');
  const analytics = useDashboardAnalytics(mapDashboardDurationOption(selectedDuration));
  const durationOptions = analytics.durationOptions.appointmentLeaders;
  const team = useTeamForPrimaryOrg();

  const nameByPractionerId = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of team) {
      if (member.practionerId) {
        map.set(member.practionerId, member.name ?? member.practionerId);
      }
    }
    return map;
  }, [team]);

  const leadersWithNames = useMemo(
    () =>
      analytics.appointmentLeaders.map((leader) => ({
        ...leader,
        month: nameByPractionerId.get(leader.staffId) ?? leader.staffId,
      })),
    [analytics.appointmentLeaders, nameByPractionerId]
  );

  useEffect(() => {
    if (!durationOptions.includes(selectedDuration)) {
      setSelectedDuration(durationOptions[0] ?? 'Last week');
    }
  }, [durationOptions, selectedDuration]);

  return (
    <div className="flex flex-col gap-2">
      <CardHeader
        title={'Appointment leaders'}
        options={durationOptions}
        selected={selectedDuration}
        onSelect={(next) => setSelectedDuration(next as DashboardDurationOption)}
      />
      <DynamicChartCard
        data={leadersWithNames}
        isEmpty={analytics.emptyState.appointmentLeaders}
        keys={[{ name: 'Completed', color: '#111' }]}
        hideKeys={false}
        layout="vertical"
        barSize={14}
        xAxisLabel="Appointments"
      />
    </div>
  );
};

export default AppointmentLeadersStat;
