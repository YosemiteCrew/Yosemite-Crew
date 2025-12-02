import React from "react";
import { GrNext, GrPrevious } from "react-icons/gr";

type DayLabels = {
  days: Date[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
};

const DayLabels = ({ days, onNextWeek, onPrevWeek }: DayLabels) => {
  return (
    <div className="grid grid-cols-[80px_minmax(0,1fr)_80px] border-b border-grey-light py-3">
      <div className="flex items-center justify-center">
        <GrPrevious
          size={20}
          color="#302f2e"
          className="cursor-pointer"
          onClick={onPrevWeek}
        />
      </div>
      <div className="grid grid-cols-7">
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
      <div className="flex items-center justify-center">
        <GrNext
          size={20}
          color="#302f2e"
          className="cursor-pointer"
          onClick={onNextWeek}
        />
      </div>
    </div>
  );
};

export default DayLabels;
