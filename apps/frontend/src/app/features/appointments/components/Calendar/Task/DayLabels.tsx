import React from 'react';
import CalendarWeekDayCell from '@/app/features/appointments/components/Calendar/common/CalendarWeekDayCell';
// yc-table-head lives here. common/WeekCalendar relies on some table elsewhere on
// the page having pulled this in; the Tasks planner may render no table at all,
// so it is imported explicitly rather than left to chance.
import '@/app/ui/tables/GenericTable/Generictable.css';

type DayLabels = {
  days: Date[];
  currentDate?: Date;
  columnsStyle?: React.CSSProperties;
};

/**
 * The Tasks planner's week date strip. The columns are `CalendarWeekDayCell`, the
 * same component the Appointments week header renders, so the two strips cannot
 * drift apart again - which is exactly what had happened: this one used to put a
 * filled 40px disc behind every date with the weekday beside it at 16px
 * near-black, leaving "today" with no signal of its own.
 */
const DayLabels = ({ days, currentDate, columnsStyle }: DayLabels) => {
  const currentDateIso = currentDate?.toISOString() ?? '';
  const now = new Date();
  return (
    <div
      className="yc-table-head yc-table-head--static yc-table-head--flush grid min-w-max"
      style={columnsStyle}
      data-current-date={currentDateIso}
      suppressHydrationWarning
    >
      {days.map((day) => (
        <CalendarWeekDayCell key={day.toISOString()} day={day} now={now} />
      ))}
    </div>
  );
};

export default DayLabels;
