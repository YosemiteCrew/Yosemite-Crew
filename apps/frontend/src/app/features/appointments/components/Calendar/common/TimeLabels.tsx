import React, { useMemo } from 'react';
import {
  MINUTES_PER_STEP,
  PIXELS_PER_STEP,
} from '@/app/features/appointments/components/Calendar/helpers';
import {
  formatHourLabel,
  formatMinuteLabel,
} from '@/app/features/appointments/components/Calendar/calendarLayout';

type TimeLabelsProps = {
  windowStart: number; // minutes since 00:00
  windowEnd: number; // minutes since 00:00
  pixelsPerStep?: number;
  slotStepMinutes?: number;
};

const TimeLabels: React.FC<TimeLabelsProps> = ({
  windowStart,
  windowEnd,
  pixelsPerStep = PIXELS_PER_STEP,
  slotStepMinutes = 15,
}) => {
  const labels = useMemo(() => {
    const startHour = Math.ceil(windowStart / 60);
    const endHour = Math.floor(windowEnd / 60);

    return Array.from({ length: Math.max(0, endHour - startHour + 1) }, (_, i) => {
      const hour = startHour + i;
      const minsFromMidnight = hour * 60;

      const top = ((minsFromMidnight - windowStart) / MINUTES_PER_STEP) * pixelsPerStep;

      const label = formatHourLabel(hour);

      return { hour, top, label };
    });
  }, [pixelsPerStep, windowStart, windowEnd]);

  const slotLabels = useMemo(() => {
    if (!labels.length) return [];
    const step = Math.max(5, Math.round(slotStepMinutes || 15));
    if (step >= 60) return [];
    const pixelsPerSlot = (step / MINUTES_PER_STEP) * pixelsPerStep;
    if (pixelsPerSlot < 14) return [];
    const entries: Array<{ key: number; top: number; label: string }> = [];
    for (let minute = windowStart + step; minute < windowEnd; minute += step) {
      if (minute % 60 === 0) continue;
      const top = ((minute - windowStart) / MINUTES_PER_STEP) * pixelsPerStep;
      entries.push({ key: minute, top, label: formatMinuteLabel(minute) });
    }
    return entries;
  }, [labels.length, pixelsPerStep, slotStepMinutes, windowEnd, windowStart]);

  return (
    <div className="relative">
      {labels.map(({ hour, top, label }) => (
        <div
          key={hour}
          className="absolute text-caption-2 text-text-primary translate-y-[-50%]"
          style={{ top }}
        >
          {label}
        </div>
      ))}
      {slotLabels.map(({ key, top, label }) => (
        <div
          key={`slot-label-${key}`}
          className="absolute text-[10px] leading-none text-text-tertiary translate-y-[-50%]"
          style={{ top }}
        >
          {label}
        </div>
      ))}
    </div>
  );
};

export default TimeLabels;
