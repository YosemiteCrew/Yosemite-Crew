import React, { useEffect, useRef, useState } from "react";
import { IoCalendarClear } from "react-icons/io5";
import { isSameDay, isSameMonth } from "../../Calendar/helpers";
import { GrNext, GrPrevious } from "react-icons/gr";
import Year from "./Year";
import Month from "./Month";
import { getFormattedDate } from "../../Calendar/weekHelpers";

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

type DatepickerProps = {
  currentDate: Date | null;
  setCurrentDate:
    | React.Dispatch<React.SetStateAction<Date | null>>
    | React.Dispatch<React.SetStateAction<Date>>;
  minYear?: number;
  maxYear?: number;
  type?: string;
  className?: string;
  containerClassName?: string;
  placeholder: string;
};

const Datepicker = ({
  currentDate,
  setCurrentDate,
  minYear = 1970,
  maxYear = 2100,
  type = "icon",
  className,
  containerClassName,
  placeholder,
}: DatepickerProps) => {
  const updateDate = setCurrentDate as React.Dispatch<
    React.SetStateAction<Date | null>
  >;
  const [isOpen, setIsOpen] = useState(false);
  const today = new Date();
  const initialYear = currentDate?.getFullYear() ?? today.getFullYear();
  const initialMonth = currentDate?.getMonth() ?? today.getMonth();
  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (currentDate) {
      setViewYear(currentDate.getFullYear());
      setViewMonth(currentDate.getMonth());
    }
  }, [currentDate]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const getCalendarDays = () => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startOffset = firstOfMonth.getDay(); // 0 = Sunday
    const startDate = new Date(viewYear, viewMonth, 1 - startOffset);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      days.push(d);
    }
    return days;
  };

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

  const handleSelectDate = (day: Date) => {
    updateDate(day);
    setIsOpen(false);
  };

  const years: number[] = [];
  for (let y = minYear; y <= maxYear; y++) {
    years.push(y);
  }

  const days = getCalendarDays();
  const viewDate = new Date(viewYear, viewMonth, 1);

  return (
    <div className={`relative ${containerClassName}`} ref={containerRef}>
      {type === "input" ? (
        <div className={`relative ${className}`}>
          <input
            type={"text"}
            name={"date-input"}
            id={"date-input"}
            value={currentDate ? getFormattedDate(currentDate) : ""}
            autoComplete="off"
            readOnly
            placeholder={""}
            className={`
            peer w-full min-h-12 rounded-2xl bg-transparent px-6 py-2.5
            text-body-4 text-text-primary
            outline-none border
            border-input-border-default!
            focus:border-input-border-active!
          `}
            onClick={() => setIsOpen(true)}
            onFocus={() => setIsOpen(true)}
          />
          <label
            htmlFor={"date-input"}
            className={`
            pointer-events-none absolute left-6
            top-1/2 -translate-y-1/2
            text-body-4 text-input-text-placeholder
            transition-all duration-200
            peer-focus:-top-[11px] peer-focus:translate-y-0
            peer-focus:text-sm!
            peer-focus:text-input-text-placeholder-active
            peer-focus:bg-(--whitebg)
            peer-focus:px-1 peer-not-placeholder-shown:px-1
            peer-not-placeholder-shown:-top-[11px] peer-not-placeholder-shown:translate-y-0
            peer-not-placeholder-shown:text-sm!
            peer-not-placeholder-shown:bg-(--whitebg)
          `}
          >
            {placeholder || "Select date"}
          </label>
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="absolute right-6 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-0 p-0"
            aria-label="Toggle calendar"
          >
            <IoCalendarClear size={20} color="#302f2e" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="rounded-2xl! border! border-input-border-default! px-[13px] py-[13px] transition-all duration-300 ease-in-out"
        >
          <IoCalendarClear size={20} color="#302f2e" />
        </button>
      )}

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-grey-light bg-white px-2 py-3 shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 mb-1 px-2">
            <GrPrevious
              size={12}
              color="#302f2e"
              onClick={handlePrevMonth}
              className="cursor-pointer"
            />

            <div className="flex items-center gap-2">
              <Month
                viewMonth={viewMonth}
                monthNames={monthNames}
                setViewMonth={setViewMonth}
              />
              <Year
                viewYear={viewYear}
                years={years}
                setViewYear={setViewYear}
              />
            </div>

            <GrNext
              size={12}
              color="#302f2e"
              onClick={handleNextMonth}
              className="cursor-pointer"
            />
          </div>

          <div className="mb-1 grid grid-cols-7 text-center text-[13px] font-satoshi font-normal text-[#bfbfbe]">
            {weekDays.map((d, i) => (
              <div key={d + i} className="h-4 w-10">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {days.map((day) => {
              const inCurrentMonth = isSameMonth(day, viewDate);
              const isSelected = isSameDay(day, currentDate);
              const isToday = isSameDay(day, today);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleSelectDate(day)}
                  className={[
                    "h-10 w-10 flex items-center justify-center rounded-full! transition text-[13px] font-satoshi font-normal hover:bg-[#EAF3FF]",
                    inCurrentMonth ? "text-black-text" : "text-[#bfbfbe]",
                    isSelected ? "bg-[#EAF3FF]" : "",
                    !isSelected && isToday && "border border-black-text",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Datepicker;
