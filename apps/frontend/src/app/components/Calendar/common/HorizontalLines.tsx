import React, { useEffect, useMemo } from "react";
import {
  MINUTES_PER_STEP,
  PIXELS_PER_STEP,
  getNowTopPxForWindow,
  getTotalWindowHeightPx,
} from "../helpers";

type HorizontalLinesProps = {
  date: Date;
  scrollRef: any;
  windowStart: number; // minutes since 00:00
  windowEnd: number; // minutes since 00:00
};

const HorizontalLines = ({
  date,
  scrollRef,
  windowStart,
  windowEnd,
}: HorizontalLinesProps) => {
  const totalHeightPx = useMemo(
    () => getTotalWindowHeightPx(windowStart, windowEnd),
    [windowStart, windowEnd]
  );

  const nowTopPx = useMemo(
    () => getNowTopPxForWindow(date, windowStart, windowEnd),
    [date, windowStart, windowEnd]
  );

  // Scroll to "now" (within the window). If now is outside, this will scroll near the end.
  useEffect(() => {
    if (!scrollRef.current || nowTopPx == null) return;
    const container = scrollRef.current;

    const targetScrollTop = Math.max(
      0,
      Math.min(
        nowTopPx - container.clientHeight / 2,
        totalHeightPx - container.clientHeight
      )
    );

    container.scrollTop = targetScrollTop;
  }, [nowTopPx, totalHeightPx, scrollRef]);

  // Draw hour lines only for hours that fall inside the window
  const hourLines = useMemo(() => {
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

        // avoid drawing at exact top/bottom edges if you want
        if (top <= 0 || top >= totalHeightPx) return null;

        return (
          <div
            key={hour}
            className="absolute left-0 right-0 border-t border-t-grey-light"
            style={{ top }}
          />
        );
      }
    ).filter(Boolean);
  }, [windowStart, windowEnd, totalHeightPx]);

  return (
    <>
      {hourLines}
      {nowTopPx != null && (
        <div className="absolute left-0 right-0 z-10" style={{ top: nowTopPx }}>
          <div className="absolute left-[-5px] w-3 h-3 rounded-full bg-red-500 translate-y-[-50%]" />
          <div className="border-t-2 border-t-red-500 translate-y-[-50%]" />
        </div>
      )}
    </>
  );
};

export default HorizontalLines;
