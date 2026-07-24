import React, { useMemo, useState } from 'react';
import CardHeader from '@/app/ui/cards/CardHeader/CardHeader';
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
    <div className="flex flex-col gap-2">
      <CardHeader
        title={'Appointment leaders'}
        options={durationOptions}
        selected={selectedDuration}
        onSelect={(next) => setSelectedDuration(next as DashboardDurationOption)}
      />
      <div
        className={`flex w-full flex-col gap-3.5 overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-[var(--screen)] px-5 py-4 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)] ${
          isEmpty ? 'min-h-89' : ''
        }`}
      >
        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[var(--ink-faint)]">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <rect x="4" y="24" width="8" height="12" rx="2" fill="var(--divider)" />
              <rect x="16" y="16" width="8" height="20" rx="2" fill="var(--divider)" />
              <rect x="28" y="10" width="8" height="26" rx="2" fill="var(--divider)" />
            </svg>
            <span className="text-[13px]">No data available</span>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default AppointmentLeadersStat;
