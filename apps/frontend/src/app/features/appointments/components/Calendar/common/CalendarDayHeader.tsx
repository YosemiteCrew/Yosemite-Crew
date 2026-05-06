import React from 'react';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';
import UserLabels from '@/app/features/appointments/components/Calendar/common/UserLabels';
import { Team } from '@/app/features/organization/types/team';

type CalendarDayNavProps = {
  weekday: string;
  dateNumber: string;
  onPrevDay: () => void;
  onNextDay: () => void;
};

/**
 * Fixed date-navigation bar — arrows flank the date, never scrolls horizontally.
 * Rendered outside the overflow-x-auto scroll container in UserCalendar.
 */
export const CalendarDayNav = ({
  weekday,
  dateNumber,
  onPrevDay,
  onNextDay,
}: CalendarDayNavProps) => (
  <div className="flex items-center justify-between gap-2 py-2 px-2 bg-white shrink-0">
    <Back onClick={onPrevDay} />
    <div className="flex items-center gap-2">
      <div className="text-body-4 text-(--color-primary-700)">{weekday}</div>
      <div className="text-body-4-emphasis text-white h-8 w-8 flex items-center justify-center rounded-full bg-text-brand">
        {dateNumber}
      </div>
    </div>
    <Next onClick={onNextDay} />
  </div>
);

type CalendarTeamNamesRowProps = {
  team: Team[];
  teamColumnsStyle: React.CSSProperties;
};

/**
 * Team-member names row — lives inside the overflow-x-auto container so it
 * scrolls in sync with the appointment columns below it.
 */
export const CalendarTeamNamesRow = ({ team, teamColumnsStyle }: CalendarTeamNamesRowProps) => (
  <div
    className="grid grid-cols-[64px_minmax(0,1fr)_64px] border-b border-grey-light min-w-max"
    style={{ background: 'color-mix(in srgb, var(--color-brand-100) 55%, white)' }}
  >
    <div className="sticky left-0 z-30" style={{ background: 'inherit' }} />
    <UserLabels team={team} columnsStyle={teamColumnsStyle} />
    <div className="sticky right-0 z-30" style={{ background: 'inherit' }} />
  </div>
);

type CalendarDayHeaderProps = {
  weekday: string;
  dateNumber: string;
  team: Team[];
  teamColumnsStyle: React.CSSProperties;
  onPrevDay: () => void;
  onNextDay: () => void;
};

const CalendarDayHeader = ({
  weekday,
  dateNumber,
  team,
  teamColumnsStyle,
  onPrevDay,
  onNextDay,
}: CalendarDayHeaderProps) => (
  <div className="min-w-max bg-white">
    <CalendarDayNav
      weekday={weekday}
      dateNumber={dateNumber}
      onPrevDay={onPrevDay}
      onNextDay={onNextDay}
    />
    <CalendarTeamNamesRow team={team} teamColumnsStyle={teamColumnsStyle} />
  </div>
);

export default CalendarDayHeader;
