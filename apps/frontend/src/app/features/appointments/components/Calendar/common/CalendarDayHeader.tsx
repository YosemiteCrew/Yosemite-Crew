import React from 'react';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';
import { Team } from '@/app/features/organization/types/team';
import { CalendarTeamNamesRow } from './CalendarTeamNamesRow';
export { CalendarTeamNamesRow } from './CalendarTeamNamesRow';

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
  <div className="flex items-center justify-between gap-2 p-2 bg-neutral-0 shrink-0">
    <Back onClick={onPrevDay} />
    <div className="flex items-center gap-2">
      <div className="text-body-4 text-(--color-primary-700)">{weekday}</div>
      <div className="text-body-4-emphasis text-white size-8 flex items-center justify-center rounded-full bg-text-brand">
        {dateNumber}
      </div>
    </div>
    <Next onClick={onNextDay} />
  </div>
);

type CalendarDayHeaderProps = {
  weekday: string;
  dateNumber: string;
  team: Team[];
  teamColumnsStyle: React.CSSProperties;
  onPrevDay: () => void;
  onNextDay: () => void;
  appointmentCounts?: Record<string, number>;
};

const CalendarDayHeader = ({
  weekday,
  dateNumber,
  team,
  teamColumnsStyle,
  onPrevDay,
  onNextDay,
  appointmentCounts,
}: CalendarDayHeaderProps) => (
  <div className="min-w-max bg-neutral-0 shrink-0">
    <CalendarDayNav
      weekday={weekday}
      dateNumber={dateNumber}
      onPrevDay={onPrevDay}
      onNextDay={onNextDay}
    />
    <CalendarTeamNamesRow
      team={team}
      teamColumnsStyle={teamColumnsStyle}
      appointmentCounts={appointmentCounts}
    />
  </div>
);

export default CalendarDayHeader;
