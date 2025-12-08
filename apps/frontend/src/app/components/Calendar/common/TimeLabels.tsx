import React from "react";
import { TOTAL_DAY_HEIGHT_PX } from "../helpers";

const TimeLabels = () => {
  return (
    <div className="relative">
      {Array.from({ length: 24 }, (_, hour) => {
        const top = (hour * TOTAL_DAY_HEIGHT_PX) / 24;
        const labelDate = new Date();
        labelDate.setHours(hour, 0, 0, 0);
        const label = labelDate.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        });
        if (hour === 0) return null;
        return (
          <div
            key={hour}
            className={`absolute font-satoshi text-[13px] text-[#747473] font-medium translate-y-[-50%]`}
            style={{
              top,
            }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
};

export default TimeLabels;
