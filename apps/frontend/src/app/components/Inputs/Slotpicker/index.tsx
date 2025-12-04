import React, { useEffect, useState } from "react";
import { GrNext, GrPrevious } from "react-icons/gr";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

type SlotpickerProps = {
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
};

const Slotpicker = ({ currentDate, setCurrentDate }: SlotpickerProps) => {
  const [viewYear, setViewYear] = useState(currentDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(currentDate.getMonth());

  useEffect(() => {
    setViewYear(currentDate.getFullYear());
    setViewMonth(currentDate.getMonth());
  }, [currentDate]);

  const handlePrevMonth = () => {
    const newDate = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(newDate.getFullYear());
    setViewMonth(newDate.getMonth());
  };

  const handleNextMonth = () => {
    const newDate = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(newDate.getFullYear());
    setViewMonth(newDate.getMonth());
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 mb-1 px-2">
        <GrPrevious
          size={16}
          color="#302f2e"
          onClick={handlePrevMonth}
          className="cursor-pointer"
        />
        <div className="text-[18px] font-satoshi font-semibold text-black-text">
          {monthNames[viewMonth]}
        </div>
        <GrNext
          size={16}
          color="#302f2e"
          onClick={handleNextMonth}
          className="cursor-pointer"
        />
      </div>
    </div>
  );
};

export default Slotpicker;
