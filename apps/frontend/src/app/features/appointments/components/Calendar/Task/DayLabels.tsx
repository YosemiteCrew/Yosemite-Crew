import React from 'react';
import {
  formatDateInPreferredTimeZone,
  isOnPreferredTimeZoneCalendarDay,
} from '@/app/lib/timezone';

type DayLabels = {
  days: Date[];
  currentDate?: Date;
  columnsStyle?: React.CSSProperties;
};

const DayLabels = ({ days, currentDate, columnsStyle }: DayLabels) => {
  const currentDateIso = currentDate?.toISOString() ?? '';
  return (
    <div
      className="grid min-w-max py-3"
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
        const isToday = isOnPreferredTimeZoneCalendarDay(new Date(), day);
        const dateNumberClass = isToday
          ? 'bg-[var(--blue-strong)] text-white border-transparent'
          : 'bg-card-bg text-text-secondary border-transparent';
        return (
          <div key={idx + day.getDate()} className="flex items-center justify-center gap-2">
            <div
              className={`text-body-4 ${isToday ? 'text-[var(--blue-text)]' : 'text-text-primary'}`}
            >
              {weekday}
            </div>
            <div
              className={`text-body-4-emphasis size-10 flex items-center justify-center rounded-full border ${dateNumberClass}`}
            >
              {dateNumber}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DayLabels;
