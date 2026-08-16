import React from 'react';
import UserLabels from '@/app/features/appointments/components/Calendar/common/UserLabels';
import { Team } from '@/app/features/organization/types/team';
import '@/app/ui/tables/GenericTable/Generictable.css';

type CalendarTeamNamesRowProps = {
  team: Team[];
  teamColumnsStyle: React.CSSProperties;
};

export const CalendarTeamNamesRow = ({ team, teamColumnsStyle }: CalendarTeamNamesRowProps) => (
  // --flush: the practitioner labels must line up column-for-column with the
  // body grid, so the recipe's 20px container padding would desynchronise them.
  // --static: the gutter spacers below are `sticky` against the horizontal
  // scroller, and making this band sticky would trap them in a new stacking
  // context. It also closed on --color-neutral-200 while every sibling band
  // closes on --hairline.
  <div className="yc-table-head yc-table-head--static yc-table-head--flush grid grid-cols-[64px_minmax(0,1fr)_64px] min-w-max">
    <div className="sticky left-0 z-30" style={{ background: 'inherit' }} />
    <UserLabels team={team} columnsStyle={teamColumnsStyle} />
    <div className="sticky right-0 z-30" style={{ background: 'inherit' }} />
  </div>
);
