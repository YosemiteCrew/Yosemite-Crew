import React from 'react';
import { isOnPreferredTimeZoneCalendarDay } from '@/app/lib/timezone';

type DayLabels = {
  days: Date[];
  currentDate?: Date;
  columnsStyle?: React.CSSProperties;
};

const DayLabels = ({ days, currentDate, columnsStyle }: DayLabels) => {
  const currentDateIso = currentDate?.toISOString() ?? '';
  return (
    <div
      className="grid min-w-max border-b border-grey-light py-3"
      style={columnsStyle}
      data-current-date={currentDateIso}
    >
      {days.map((day, idx) => {
        const weekday = day.toLocaleDateString('en-US', {
          weekday: 'short',
        });
        const dateNumber = day.getDate();
        const isToday = isOnPreferredTimeZoneCalendarDay(new Date(), day);
        const dateNumberClass = isToday
          ? 'bg-text-brand text-white border-transparent'
          : 'bg-card-bg text-text-secondary border-transparent';
        return (
          <div key={idx + day.getDate()} className="flex items-center justify-center flex-col">
            <div className={`text-body-4 ${isToday ? 'text-text-brand' : 'text-text-primary'}`}>
              {weekday}
            </div>
            <div
              className={`text-body-4-emphasis h-10 w-10 flex items-center justify-center rounded-full border ${dateNumberClass}`}
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
