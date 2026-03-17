import React, { useMemo } from 'react';
import {
  MINUTES_PER_STEP,
  PIXELS_PER_STEP,
} from '@/app/features/appointments/components/Calendar/helpers';
import { formatHourLabel } from '@/app/features/appointments/components/Calendar/calendarLayout';

type TimeLabelsProps = {
  windowStart: number; // minutes since 00:00
  windowEnd: number; // minutes since 00:00
  pixelsPerStep?: number;
};

const TimeLabels: React.FC<TimeLabelsProps> = ({
  windowStart,
  windowEnd,
  pixelsPerStep = PIXELS_PER_STEP,
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
    </div>
  );
};

export default TimeLabels;
