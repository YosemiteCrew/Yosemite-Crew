import React, { useEffect, useRef, useState } from "react";
import {
  AvailabilityState,
  getTimeLabelFromValue,
  Interval,
  timeIndex,
  TimeOption,
} from "./utils";

import "./Availability.css";

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
    <div className="availability-interval-time" ref={availabilityContainerRef}>
      <button
        className="availability-interval-time-title"
        onClick={() => setOpen((e: boolean) => !e)}
      >
        {getTimeLabelFromValue(interval[field]) || "Select"}
      </button>
      {open && (
        <div className="availability-interval-dropdown scrollbar-hidden">
          {timeOptions.map((opt: TimeOption) => (
            <button
              key={opt.value}
              className="availability-interval-dropdown-item"
              onClick={() => handleTimeChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TimeSlot;
