import React from 'react';
import {
  formatHourLabel,
  formatMinuteLabel,
} from '@/app/features/appointments/components/Calendar/calendarLayout';

type CalendarHourLabelProps = {
  hour: number;
  height: number;
  slotOffsetMinutes: number[];
  showSlotTimeLabels: boolean;
  /** When true, pins the first hour label at top-0 instead of -translate-y-1/2 */
  pinFirstHour?: boolean;
  /** Override which hour is considered "first" for pinning (defaults to 0) */
  firstHour?: number;
  /** Additional tailwind classes for the outer div */
  className?: string;
};

const CalendarHourLabel: React.FC<CalendarHourLabelProps> = ({
  hour,
  height,
  slotOffsetMinutes,
  showSlotTimeLabels,
  pinFirstHour = false,
  firstHour = 0,
  className = '',
}) => (
  <div
    className={`text-caption-2 text-text-primary pl-2! relative ${className}`}
    style={{ height: `${height}px` }}
  >
    <span
      className={`absolute top-0 ${pinFirstHour && hour === firstHour ? 'translate-y-0' : '-translate-y-1/2'}`}
    >
      {formatHourLabel(hour)}
    </span>
    {showSlotTimeLabels &&
      slotOffsetMinutes.map((minute) => (
        <span
          key={`slot-time-${hour}-${minute}`}
          className="absolute right-1 -translate-y-1/2 text-[10px] leading-none text-text-tertiary text-right whitespace-nowrap"
          style={{ top: `${(minute / 60) * 100}%` }}
        >
          {formatMinuteLabel(hour * 60 + minute)}
        </span>
      ))}
  </div>
);

export default CalendarHourLabel;
