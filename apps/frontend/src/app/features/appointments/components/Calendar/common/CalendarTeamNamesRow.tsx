import React from 'react';
import UserLabels from '@/app/features/appointments/components/Calendar/common/UserLabels';
import { Team } from '@/app/features/organization/types/team';

type CalendarTeamNamesRowProps = {
  team: Team[];
  teamColumnsStyle: React.CSSProperties;
};

export const CalendarTeamNamesRow = ({ team, teamColumnsStyle }: CalendarTeamNamesRowProps) => (
  <div
    className="grid grid-cols-[64px_minmax(0,1fr)_64px] border-b border-grey-light min-w-max"
    style={{ background: 'color-mix(in srgb, var(--color-brand-100) 55%, var(--screen))' }}
  >
    <div className="sticky left-0 z-30" style={{ background: 'inherit' }} />
    <UserLabels team={team} columnsStyle={teamColumnsStyle} />
    <div className="sticky right-0 z-30" style={{ background: 'inherit' }} />
  </div>
);
