import React from 'react';
import {
  formatDateInPreferredTimeZone,
  isOnPreferredTimeZoneCalendarDay,
} from '@/app/lib/timezone';
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
 * The week date strip, matching `common/WeekCalendar.tsx:190-231` day for day.
 *
 * This was the loudest difference between the two calendars. It put a filled
 * 40px disc behind EVERY date with the weekday beside it at 16px near-black,
 * where the Appointments strip stacks a small caps weekday over a bare numeral
 * and reserves the disc for today. Two consequences: the row read as seven grey
 * buttons at roughly 1.5x the type size, and because every date already wore a
 * disc, "today" had no signal left - the one thing the strip exists to tell you.
 *
 * The `yc-table-head` recipe (10.5px / 700 / +0.1em caps) is the same one every
 * other table header in PIMS uses, so the strip now belongs to the same system
 * rather than the generic body scale.
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
      {days.map((day, idx) => {
        // The preferred zone, not the browser's. isToday below already uses it,
        // and the Appointments week header does too (common/WeekCalendar.tsx:195),
        // so a user whose browser zone differs from the org's could see the same
        // column labelled Tue on one calendar and Mon on the other.
        const weekday = formatDateInPreferredTimeZone(day, { weekday: 'short' });
        const dateNumber = day.getDate();
        const isToday = isOnPreferredTimeZoneCalendarDay(now, day);
        return (
          <div
            key={idx + day.getDate()}
            className="flex flex-col items-center gap-px border-l px-1 py-2"
            style={{
              borderColor: 'var(--hairline)',
              backgroundColor: isToday ? 'var(--nav-active-bg)' : undefined,
            }}
          >
            <div style={{ color: isToday ? 'var(--nav-active)' : 'var(--ink-faint)' }}>
              {weekday}
            </div>
            {isToday ? (
              <div
                className="flex size-6 items-center justify-center rounded-full text-[13px] font-bold normal-case tracking-normal text-white"
                style={{ backgroundColor: 'var(--blue-strong)' }}
              >
                {dateNumber}
              </div>
            ) : (
              <div
                className="text-[14px] font-bold normal-case tracking-normal"
                style={{ color: 'var(--ink)' }}
              >
                {dateNumber}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DayLabels;
