import React, { useMemo } from 'react';
import {
  MINUTES_PER_STEP,
  PIXELS_PER_STEP,
  getNowTopPxForWindow,
} from '@/app/features/appointments/components/Calendar/helpers';
import { formatDateInPreferredTimeZone } from '@/app/lib/timezone';

type HorizontalLinesProps = {
  date: Date;
  now?: Date;
  windowStart: number; // minutes since 00:00
  windowEnd: number; // minutes since 00:00
  pixelsPerStep?: number;
};

const HorizontalLines = ({
  date,
  now,
  windowStart,
  windowEnd,
  pixelsPerStep = PIXELS_PER_STEP,
}: HorizontalLinesProps) => {
  const totalHeightPx = useMemo(
    () => ((windowEnd - windowStart) / MINUTES_PER_STEP) * pixelsPerStep,
    [pixelsPerStep, windowEnd, windowStart]
  );

  const nowTopPx = useMemo(() => {
    const baseTopPx = getNowTopPxForWindow(date, windowStart, windowEnd, now);
    if (baseTopPx == null) return null;
    return baseTopPx * (pixelsPerStep / PIXELS_PER_STEP);
  }, [date, now, pixelsPerStep, windowStart, windowEnd]);
  const nowTimeLabel = useMemo(() => {
    if (nowTopPx == null) return null;
    return formatDateInPreferredTimeZone(now ?? new Date(), {
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [now, nowTopPx]);

  // Draw hour lines only for hours that fall inside the window
  const hourLines = useMemo(() => {
    const startHour = Math.ceil(windowStart / 60);
    const endHour = Math.floor(windowEnd / 60);

    return Array.from({ length: Math.max(0, endHour - startHour + 1) }, (_, i) => {
      const hour = startHour + i;
      const minsFromMidnight = hour * 60;

      const top = ((minsFromMidnight - windowStart) / MINUTES_PER_STEP) * pixelsPerStep;

      // avoid drawing at exact top/bottom edges if you want
      if (top <= 0 || top >= totalHeightPx) return null;

      return (
        <div
          key={hour}
          className="absolute left-0 right-0 border-t border-t-grey-light"
          style={{ top }}
        />
      );
    }).filter(Boolean);
  }, [pixelsPerStep, windowStart, windowEnd, totalHeightPx]);

  return (
    <>
      {hourLines}
      {nowTopPx != null && (
        <div className="absolute left-0 right-0 z-10" style={{ top: nowTopPx }}>
          {nowTimeLabel && (
            <div className="absolute left-3 -translate-y-[115%] text-[10px] leading-none font-semibold text-red-500 whitespace-nowrap">
              {nowTimeLabel}
            </div>
          )}
          <div className="absolute left-[-5px] w-3 h-3 rounded-full bg-red-500 translate-y-[-50%]" />
          <div className="border-t-2 border-t-red-500 translate-y-[-50%]" />
        </div>
      )}
    </>
  );
};

export default HorizontalLines;
