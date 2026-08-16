import React, { useMemo, useState } from 'react';
import StatCardShell from '@/app/ui/widgets/Stats/StatCardShell';
import {
  DashboardDurationOption,
  mapDashboardDurationOption,
  useDashboardAnalytics,
} from '@/app/features/dashboard/hooks/useDashboardAnalytics';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';

// Rank flourish from the design: bars fade as they descend the leaderboard.
const rankOpacity = (index: number) => {
  if (index === 0) return 1;
  if (index === 1) return 0.82;
  if (index === 2) return 0.64;
  return 0.5;
};

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

  const effectiveDuration = durationOptions.includes(selectedDuration)
    ? selectedDuration
    : (durationOptions[0] ?? 'Last week');
  if (effectiveDuration !== selectedDuration) setSelectedDuration(effectiveDuration);

  const isEmpty = analytics.emptyState.appointmentLeaders;
  const maxCompleted = leadersWithNames.reduce((max, leader) => Math.max(max, leader.Completed), 0);

  return (
    <StatCardShell
      title={'Appointment leaders'}
      options={durationOptions}
      selected={selectedDuration}
      onSelect={(next) => setSelectedDuration(next as DashboardDurationOption)}
      isEmpty={isEmpty}
      cardClassName={`gap-3.5 overflow-hidden ${isEmpty ? 'min-h-89' : ''}`}
    >
      <div className="flex flex-col gap-2.5">
        {leadersWithNames.map((leader, index) => {
          const width = maxCompleted > 0 ? (leader.Completed / maxCompleted) * 100 : 0;
          return (
            <div
              key={`${leader.staffId}-${index + 1}`}
              className="grid grid-cols-[minmax(0,130px)_1fr_34px] items-center gap-2.5"
            >
              <span className="truncate text-[12.5px] font-semibold text-[var(--ink-body)]">
                {leader.month}
              </span>
              <div
                className="h-3.5 rounded-[4px] bg-[var(--cta)]"
                style={{
                  width: `${Math.max(0, Math.min(100, width))}%`,
                  opacity: rankOpacity(index),
                }}
              />
              <span className="text-right text-[12px] font-bold text-[var(--ink)] tabular-nums">
                {leader.Completed}
              </span>
            </div>
          );
        })}
      </div>
    </StatCardShell>
  );
};

export default AppointmentLeadersStat;
