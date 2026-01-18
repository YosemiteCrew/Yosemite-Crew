import React, { useEffect, useRef, useState } from "react";
import {
  AvailabilityState,
  getTimeLabelFromValue,
  Interval,
  timeIndex,
  TimeOption,
} from "./utils";

type Field = keyof Interval;

interface TimeSlotProps {
  interval: Interval;
  timeOptions: TimeOption[];
  setAvailability: React.Dispatch<React.SetStateAction<AvailabilityState>>;
  day: string;
  intervalIndex: number;
  field: Field;
}

const TimeSlot: React.FC<TimeSlotProps> = ({
  interval,
  timeOptions,
  setAvailability,
  day,
  intervalIndex,
  field,
}) => {
  const [open, setOpen] = useState<boolean>(false);
  const availabilityContainerRef = useRef<HTMLDivElement>(null);

  const handleTimeChange = (value: string) => {
    setAvailability((prev: AvailabilityState) => {
      const updated = [...prev[day].intervals];
      const interval: Interval = { ...updated[intervalIndex], [field]: value };

      // Reset end if start becomes later than current end
      const startIdx = timeIndex.get(interval.start) ?? -1;
      const endIdx = timeIndex.get(interval.end) ?? -1;
      if (field === "start" && interval.end && startIdx >= endIdx) {
        interval.end = "";
      }

      updated[intervalIndex] = interval;
      return { ...prev, [day]: { ...prev[day], intervals: updated } };
    });
    setOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        availabilityContainerRef.current &&
        !availabilityContainerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative w-[120px]" ref={availabilityContainerRef}>
      <button
        className="bg-white rounded-2xl! border border-text-primary justify-center w-full outline-none py-[11px]"
        onClick={() => setOpen((e: boolean) => !e)}
      >
        <span className="text-body-4 text-text-primary ">
          {getTimeLabelFromValue(interval[field]) || "Select"}
        </span>
      </button>
      {open && (
        <div className="max-h-[200px] z-10 w-[120px] overflow-y-scroll scrollbar-hidden flex flex-col bg-white rounded-2xl border border-card-border absolute left-0 top-[110%] py-2 px-2">
          {timeOptions.map((opt: TimeOption) => (
            <button
              key={opt.value}
              className="border-none outline-none bg-white text-center py-2 hover:bg-card-hover! rounded-2xl! transition-all duration-300"
              onClick={() => handleTimeChange(opt.value)}
            >
              <span className="text-body-4 text-text-primary ">
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TimeSlot;
