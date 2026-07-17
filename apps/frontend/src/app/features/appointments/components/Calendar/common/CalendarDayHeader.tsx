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
 * Date-navigation bar — arrows flank the date.
 * UserCalendar renders this inside its overflow-x-auto scroll container, on a min-w-max
 * track sized to the full team grid. `sticky left-0` pins the bar to the viewport's left
 * edge so it stays reachable at any scroll offset, and `w-fit` keeps it sized to its own
 * content instead of stretching the arrows across the whole scrollable width.
 */
export const CalendarDayNav = ({
  weekday,
  dateNumber,
  onPrevDay,
  onNextDay,
}: CalendarDayNavProps) => (
  <div className="sticky left-0 z-30 flex w-fit items-center gap-2 p-2 bg-white shrink-0">
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
};

const CalendarDayHeader = ({
  weekday,
  dateNumber,
  team,
  teamColumnsStyle,
  onPrevDay,
  onNextDay,
}: CalendarDayHeaderProps) => (
  <div className="min-w-max bg-white shrink-0">
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
