import React, { useEffect, useRef, useState } from "react";
import { getTimeLabelFromValue, timeIndex } from "./utils";

import "./Availability.css";

const TimeSlot = ({
  interval,
  timeOptions,
  setAvailability,
  day,
  intervalIndex,
  field
}: any) => {
  const [open, setOpen] = useState(false);
  const availabilityContainerRef = useRef<HTMLDivElement>(null);

  const handleTimeChange = (value: any) => {
    setAvailability((prev: any) => {
      const updated = [...prev[day].intervals];
      const interval = { ...updated[intervalIndex], [field]: value };

      // Reset end if start becomes later than current end
      const startIdx = timeIndex.get(interval.start) ?? -1;
      const endIdx = timeIndex.get(interval.end) ?? -1;
      if (field === "start" && interval.end && startIdx >= endIdx) {
        interval.end = "";
      }

      updated[intervalIndex] = interval;
      return { ...prev, [day]: { ...prev[day], intervals: updated } };
    });
    setOpen(false)
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
        <div className="availability-interval-dropdown">
          {timeOptions.map((opt: any) => (
            <button
              key={opt.value}
              className="availability-interval-dropdown-item"
              onClick={() =>
                handleTimeChange(opt.value)
              }
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
