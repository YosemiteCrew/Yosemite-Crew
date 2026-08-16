import React from 'react';
import UserLabels from '@/app/features/appointments/components/Calendar/common/UserLabels';
import { Team } from '@/app/features/organization/types/team';

type CalendarTeamNamesRowProps = {
  team: Team[];
  teamColumnsStyle: React.CSSProperties;
};

export const CalendarTeamNamesRow = ({ team, teamColumnsStyle }: CalendarTeamNamesRowProps) => (
  // Takes the shared BAND, not the shared TYPE. This strip's labels are
  // practitioner names - "Dr. Sarah Weber" and a speciality subline - which are
  // data, not column nouns, and UserLabels resets neither casing nor tracking.
  // Applying the full recipe here rendered every name in wide-tracked capitals.
  // The band itself was still wrong though: it closed on --color-neutral-200
  // while every sibling calendar band closes on --hairline.
  <div
    className="grid grid-cols-[64px_minmax(0,1fr)_64px] border-b border-[var(--hairline)] min-w-max"
    style={{ background: 'var(--screen-2)' }}
  >
    <div className="sticky left-0 z-30" style={{ background: 'inherit' }} />
    <UserLabels team={team} columnsStyle={teamColumnsStyle} />
    <div className="sticky right-0 z-30" style={{ background: 'inherit' }} />
  </div>
);
