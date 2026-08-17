import React from 'react';
import {
  formatDateInPreferredTimeZone,
  isOnPreferredTimeZoneCalendarDay,
} from '@/app/lib/timezone';

/**
 * One column of a week date strip: a small caps weekday over the date numeral,
 * with the disc and the column wash reserved for today.
 *
 * Shared because the two planners drew this differently, and copying the
 * Appointments treatment into the Tasks one is what caused the divergence in the
 * first place. Tasks used to put a filled 40px disc behind EVERY date with the
 * weekday beside it at 16px near-black, so the row read as seven grey buttons at
 * roughly 1.5x the type size - and with every date already wearing a disc,
 * "today" had no signal left, which is the one thing the strip exists to tell
 * you. One component means the next change lands on both calendars at once.
 *
 * The caps and tracking come from `yc-table-head` on the container, the same
 * recipe every other PIMS table header uses, so the strip belongs to the table
 * system rather than the generic body scale.
 */
const CalendarWeekDayCell = ({ day, now }: { day: Date; now: Date }) => {
  const weekday = formatDateInPreferredTimeZone(day, { weekday: 'short' });
  const dateNumber = day.getDate();
  const isToday = isOnPreferredTimeZoneCalendarDay(now, day);

  return (
    <div
      className="flex flex-col items-center gap-px border-l px-1 py-2"
      style={{
        borderColor: 'var(--hairline)',
        backgroundColor: isToday ? 'var(--nav-active-bg)' : undefined,
      }}
    >
      <div style={{ color: isToday ? 'var(--nav-active)' : 'var(--ink-faint)' }}>{weekday}</div>
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
};

export default CalendarWeekDayCell;
