import React, { useMemo } from "react";
import { MINUTES_PER_STEP, PIXELS_PER_STEP } from "../helpers";

type TimeLabelsProps = {
  windowStart: number; // minutes since 00:00
  windowEnd: number; // minutes since 00:00
};

const TimeLabels: React.FC<TimeLabelsProps> = ({ windowStart, windowEnd }) => {
  const labels = useMemo(() => {
    const startHour = Math.ceil(windowStart / 60);
    const endHour = Math.floor(windowEnd / 60);

    return Array.from(
      { length: Math.max(0, endHour - startHour + 1) },
      (_, i) => {
        const hour = startHour + i;
        const minsFromMidnight = hour * 60;

        const top =
          ((minsFromMidnight - windowStart) / MINUTES_PER_STEP) *
          PIXELS_PER_STEP;

        const d = new Date();
        d.setHours(hour, 0, 0, 0);

        const label = d.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        });

        return { hour, top, label };
      }
    );
  }, [windowStart, windowEnd]);

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
