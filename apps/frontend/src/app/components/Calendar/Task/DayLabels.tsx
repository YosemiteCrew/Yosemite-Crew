import React from "react";

type DayLabels = {
  days: Date[];
};

const DayLabels = ({ days }: DayLabels) => {
  return (
    <div className="grid grid-flow-col auto-cols-[200px] gap-x-2 min-w-max border-b border-grey-light py-3">
      {days.map((day, idx) => {
        const weekday = day.toLocaleDateString("en-US", {
          weekday: "short",
        });
        const dateNumber = day.getDate();
        return (
          <div
            key={idx + day.getDate()}
            className="flex gap-1 items-center justify-center font-satoshi text-[13px] text-[#747473] font-medium"
          >
            <div className="">{weekday}</div>
            <div className="">{dateNumber}</div>
          </div>
        );
      })}
    </div>
  );
};

export default DayLabels;
