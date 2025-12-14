import React from "react";
import {
  daysOfWeek,
  timeIndex,
  timeOptions,
  DEFAULT_INTERVAL,
  AvailabilityState,
  TimeOption,
  Interval,
  SetAvailability,
} from "./utils";
import TimeSlot from "./TimeSlot";
import { FaCirclePlus, FaCircleMinus } from "react-icons/fa6";
import Dublicate from "./Dublicate";

import "./Availability.css";

type AvailabilityProps = {
  availability: AvailabilityState;
  setAvailability: SetAvailability;
};

const Availability: React.FC<AvailabilityProps> = ({
  availability,
  setAvailability,
}) => {
  const toggleDay = (day: string) => {
    setAvailability((prev: AvailabilityState) => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled },
    }));
  };

  const addInterval = (day: string) => {
    setAvailability((prev: AvailabilityState) => ({
      ...prev,
      [day]: {
        ...prev[day],
        intervals: [...prev[day].intervals, { ...DEFAULT_INTERVAL }],
      },
    }));
  };

  const deleteInterval = (day: string, index: number) => {
    setAvailability((prev: AvailabilityState) => {
      if (index === 0) return prev;
      const updated = prev[day].intervals.filter((_, i) => i !== index);
      return {
        ...prev,
        [day]: {
          ...prev[day],
          intervals: updated.length ? updated : [{ ...DEFAULT_INTERVAL }],
        },
      };
    });
  };

  const getEndOptions = (startValue: string): TimeOption[] => {
    if (!startValue) return timeOptions;
    const startIdx = timeIndex.get(startValue) ?? -1;
    return timeOptions.filter((_, idx) => idx > startIdx);
  };

  return (
    <div className="availability-container">
      {daysOfWeek.map((day: string, dayIndex: number) => (
        <div key={day} className="availability-day">
          <label className="availability-check-label">
            <input
              type="checkbox"
              checked={availability[day].enabled}
              onChange={() => toggleDay(day)}
              className="availability-check"
            />
            <span className="availability-check-title">{day}</span>
          </label>

          {availability[day].enabled && (
            <div className="availability-intervals">
              {availability[day].intervals.map(
                (interval: Interval, i: number) => {
                  const endOptions = getEndOptions(interval.start);
                  return (
                    <div
                      key={i + interval.start}
                      className="availability-interval"
                    >
                      <TimeSlot
                        interval={interval}
                        timeOptions={timeOptions}
                        setAvailability={setAvailability}
                        day={day}
                        intervalIndex={i}
                        field="start"
                      />
                      <TimeSlot
                        interval={interval}
                        timeOptions={endOptions}
                        setAvailability={setAvailability}
                        day={day}
                        intervalIndex={i}
                        field="end"
                      />
                      {i === 0 ? (
                        <button
                          onClick={() => addInterval(day)}
                          className="availability-interval-buttons"
                          title="Add interval"
                        >
                          <FaCirclePlus color="#000" size={20} />
                        </button>
                      ) : (
                        <button
                          onClick={() => deleteInterval(day, i)}
                          className="availability-interval-buttons"
                          title="Delete interval"
                        >
                          <FaCircleMinus color="#000" size={20} />
                        </button>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}

          {availability[day].enabled && (
            <Dublicate setAvailability={setAvailability} day={day} />
          )}
        </div>
      ))}
    </div>
  );
};

export default Availability;
