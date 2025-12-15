import React, { useEffect } from "react";
import { getNowTopPxForDay, TOTAL_DAY_HEIGHT_PX } from "../helpers";

type HorizontalLinesProps = {
  date: Date;
  scrollRef: any;
};

const HorizontalLines = ({ date, scrollRef }: HorizontalLinesProps) => {
  const nowTopPx = getNowTopPxForDay(date);

  useEffect(() => {
    if (!scrollRef.current || nowTopPx == null) return;
    const container = scrollRef.current;
    const targetScrollTop = Math.max(0, nowTopPx - container.clientHeight / 2);
    container.scrollTop = targetScrollTop;
  }, [nowTopPx]);

  return (
    <>
      {Array.from({ length: 24 }, (_, hour) => {
        if (hour === 0 || hour === 23 + 1) return null;
        const top = (hour * TOTAL_DAY_HEIGHT_PX) / 24;
        return (
          <div
            key={hour}
            className="absolute left-0 right-0 border-t border-t-grey-light"
            style={{
              top,
            }}
          />
        );
      })}
      {nowTopPx != null && (
        <div
          className="absolute left-0 right-0 z-10"
          style={{
            top: nowTopPx,
          }}
        >
          <div className="absolute left-[-5px] w-3 h-3 rounded-full bg-red-500 translate-y-[-50%]" />
          <div className="border-t-2 border-t-red-500 translate-y-[-50%]" />
        </div>
      )}
    </>
  );
};

export default HorizontalLines;
