import React, { useState } from "react";
import { daysOfWeek, timeIndex, timeOptions, DEFAULT_INTERVAL } from "./utils";
import TimeSlot from "./TimeSlot";
import { FaCirclePlus, FaCircleMinus } from "react-icons/fa6";
import Dublicate from "./Dublicate";

import "./Availability.css";

const Availability = () => {
  const [availability, setAvailability] = useState(
    daysOfWeek.reduce((acc, day): any => {
      const isWeekday =
        day === "Monday" ||
        day === "Tuesday" ||
        day === "Wednesday" ||
        day === "Thursday" ||
        day === "Friday";
      acc[day] = {
        enabled: isWeekday,
        intervals: [{ ...DEFAULT_INTERVAL }],
      };
      return acc;
    }, {})
  );

  const toggleDay = (day: any) => {
    setAvailability((prev: any) => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled },
    }));
  };

  const addInterval = (day: any) => {
    setAvailability((prev: any) => ({
      ...prev,
      [day]: {
        ...prev[day],
        intervals: [...prev[day].intervals, { ...DEFAULT_INTERVAL }],
      },
    }));
  };

  const deleteInterval = (day: any, index: any) => {
    setAvailability((prev: any) => {
      if (index === 0) return prev;
      const updated = prev[day].intervals.filter(
        (_: any, i: any) => i !== index
      );
      return {
        ...prev,
        [day]: {
          ...prev[day],
          intervals: updated.length ? updated : [{ ...DEFAULT_INTERVAL }],
        },
      };
    });
  };

  const getEndOptions = (startValue: any) => {
    if (!startValue) return timeOptions;
    const startIdx = timeIndex.get(startValue) ?? -1;
    return timeOptions.filter((_, idx) => idx > startIdx);
  };

  return (
    <div className="availability-container">
      {daysOfWeek.map((day, dayIndex) => (
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
              {availability[day].intervals.map((interval: any, i: any) => {
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
              })}
            </div>
          )}

          {availability[day].enabled && (
            <Dublicate
              setAvailability={setAvailability}
              day={day}
              dayIndex={dayIndex}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default Availability;
