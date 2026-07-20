import React from 'react';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';
import { Team } from '@/app/features/organization/types/team';
import { CalendarTeamNamesRow } from './CalendarTeamNamesRow';
export { CalendarTeamNamesRow } from './CalendarTeamNamesRow';

type CalendarDayNavProps = {
  weekday: string;
  dateNumber: string;
  /**
   * Inline day-stepper arrows. Omitted by the appointments planner, whose header
   * toolbar owns navigation via its date-nav pill; the task calendar still passes
   * them and keeps its arrows here.
   */
  onPrevDay?: () => void;
  onNextDay?: () => void;
};

/**
 * Date band above the team columns, styled like the week grid's day headers: an
 * all-caps 9.5px/700/0.08em --ink-faint label over the 14px/700 date on the
 * --screen-2 band.
 *
 * UserCalendar renders this inside its overflow-x-auto scroll container, on a
 * min-w-max track sized to the full team grid, so `sticky left-0` keeps the date
 * legible at any horizontal scroll offset and `w-fit` stops it stretching across
 * the whole scrollable width.
 */
export const CalendarDayNav = ({
  weekday,
  dateNumber,
  onPrevDay,
  onNextDay,
}: CalendarDayNavProps) => {
  const hasInlineNav = !!onPrevDay && !!onNextDay;
  return (
    <div
      className={`sticky left-0 z-30 flex w-fit shrink-0 items-center gap-1.5 py-2 ${
        hasInlineNav ? 'px-2' : 'px-4'
      }`}
      style={{ backgroundColor: 'var(--screen-2)' }}
    >
      {hasInlineNav && <Back onClick={onPrevDay} />}
      <div className="flex items-baseline gap-1.5">
        <div
          className="text-[9.5px] font-bold uppercase tracking-[0.08em]"
          style={{ color: 'var(--ink-faint)' }}
        >
          {weekday}
        </div>
        <div className="text-[14px] font-bold" style={{ color: 'var(--ink)' }}>
          {dateNumber}
        </div>
      </div>
      {hasInlineNav && <Next onClick={onNextDay} />}
    </div>
  );
};

type CalendarDayHeaderProps = {
  weekday: string;
  dateNumber: string;
  team: Team[];
  teamColumnsStyle: React.CSSProperties;
  onPrevDay?: () => void;
  onNextDay?: () => void;
};

const CalendarDayHeader = ({
  weekday,
  dateNumber,
  team,
  teamColumnsStyle,
  onPrevDay,
  onNextDay,
}: CalendarDayHeaderProps) => (
  <div className="min-w-max shrink-0" style={{ backgroundColor: 'var(--screen-2)' }}>
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
