import { isSameDay } from "@/app/features/appointments/components/Calendar/helpers";
import React from "react";

type DayLabels = {
  days: Date[];
  currentDate: Date;
};

const DayLabels = ({ days, currentDate }: DayLabels) => {
  return (
    <div className="grid grid-flow-col auto-cols-[170px] min-w-max border-b border-grey-light py-3">
      {days.map((day, idx) => {
        const weekday = day.toLocaleDateString("en-US", {
          weekday: "short",
        });
        const dateNumber = day.getDate();
        const isCurrentDate = isSameDay(day, currentDate);
        const isToday = isSameDay(day, new Date());
        let dateNumberClass =
          "bg-card-bg text-text-secondary border-transparent";
        if (isCurrentDate) {
          dateNumberClass = "bg-text-brand text-white border-transparent";
        } else if (isToday) {
          dateNumberClass = "bg-white text-text-primary border-card-border";
        }
        return (
          <div
            key={idx + day.getDate()}
            className="flex items-center justify-center flex-col"
          >
            <div
              className={`text-body-4 ${
                isCurrentDate ? "text-text-brand" : "text-text-primary"
              }`}
            >
              {weekday}
            </div>
            <div
              className={`text-body-4-emphasis h-10 w-10 flex items-center justify-center rounded-full border ${dateNumberClass}`}
            >
              {dateNumber}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DayLabels;
