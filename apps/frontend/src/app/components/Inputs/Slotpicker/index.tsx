import React, { useEffect, useMemo, useState } from "react";
import { GrNext, GrPrevious } from "react-icons/gr";
import {
  getDateNumberPadded,
  getNextWeek,
  getPrevWeek,
  getShortWeekday,
  getStartOfWeek,
  getWeekDays,
} from "../../Calendar/weekHelpers";
import { isSameDay } from "../../Calendar/helpers";
import { Slot } from "@/app/types/appointments";
import { formatUtcTimeToLocalLabel } from "../../Availability/utils";

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

type SlotpickerProps = {
  selectedDate: Date;
  setSelectedDate: React.Dispatch<React.SetStateAction<Date>>;
  selectedSlot: Slot | null;
  setSelectedSlot: React.Dispatch<React.SetStateAction<Slot | null>>;
  timeSlots: Slot[];
};

const Slotpicker = ({
  selectedDate,
  setSelectedDate,
  selectedSlot,
  setSelectedSlot,
  timeSlots,
}: SlotpickerProps) => {
  const [weekStart, setWeekStart] = useState(getStartOfWeek(selectedDate));
  const [viewYear, setViewYear] = useState(weekStart.getFullYear());
  const [viewMonth, setViewMonth] = useState(weekStart.getMonth());
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);

  useEffect(() => {
    setWeekStart(getStartOfWeek(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    setViewYear(weekStart.getFullYear());
    setViewMonth(weekStart.getMonth());
  }, [weekStart]);

  const handlePrevMonth = () => {
    const newDate = new Date(viewYear, viewMonth - 1, 7);
    setWeekStart(getStartOfWeek(newDate));
  };

  const handleNextMonth = () => {
    console.log("first");
    const newDate = new Date(viewYear, viewMonth + 1, 7);
    setWeekStart(getStartOfWeek(newDate));
  };

  const handlePrevWeek = () => {
    setWeekStart((prev) => {
      const nextWeekStart = getPrevWeek(prev);
      return nextWeekStart;
    });
  };

  const handleNextWeek = () => {
    setWeekStart((prev) => {
      const nextWeekStart = getNextWeek(prev);
      return nextWeekStart;
    });
  };

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const isPastDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d < today;
  };

  const handleClickdate = (date: Date) => {
    if (isPastDay(date)) return;
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const isSameSlot = (a: Slot | null, b: Slot) =>
    !!a && a.startTime === b.startTime && a.endTime === b.endTime;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 mb-1">
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
      <div className="flex items-center justify-between gap-2 mb-1">
        <GrPrevious
          size={16}
          color="#302f2e"
          onClick={handlePrevWeek}
          className="cursor-pointer"
        />
        <div className="grid grid-cols-7 gap-x-2">
          {days.map((day) => {
            const isCurrent = isSameDay(selectedDate, day);
            return (
              <button
                key={day.toISOString()}
                onClick={() => handleClickdate(day)}
                className={`${isCurrent ? "text-[#247AED] bg-[#E9F2FD] border-[#247AED]!" : "border-[#747473]! bg-white"} flex flex-col gap-1 items-center justify-center px-3 py-2 border rounded-xl!`}
              >
                <div>{getShortWeekday(day)}</div>
                <div>{getDateNumberPadded(day)}</div>
              </button>
            );
          })}
        </div>
        <GrNext
          size={16}
          color="#302f2e"
          onClick={handleNextWeek}
          className="cursor-pointer"
        />
      </div>
      <div className="flex flex-wrap gap-2 px-2">
        {timeSlots?.length > 0 &&
          timeSlots.map((slot, i) => {
            const selected = isSameSlot(selectedSlot, slot);
            return (
              <button
                key={slot.startTime + i}
                onClick={() => setSelectedSlot(slot)}
                className={`${selected ? "text-[#247AED] bg-[#E9F2FD] border-[#247AED]!" : "border-[#747473]! bg-white"} px-3 py-2 flex items-center justify-center border rounded-xl! text-[13px]! font-grotesk font-medium`}
              >
                {formatUtcTimeToLocalLabel(slot.startTime)}
              </button>
            );
          })}
          {timeSlots.length === 0 && (
            <div className="text-center w-full text-caption-1 text-text-primary py-3">No slot available</div>
          )}
      </div>
    </div>
  );
};

export default Slotpicker;
