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
  ApiOverrides,
} from "./utils";
import TimeSlot from "./TimeSlot";
import { FaCirclePlus, FaCircleMinus } from "react-icons/fa6";
import Dublicate from "./Dublicate";

type AvailabilityProps = {
  availability: AvailabilityState;
  setAvailability: SetAvailability;
  overides?: ApiOverrides[];
  setOverides?: React.Dispatch<React.SetStateAction<ApiOverrides[]>>;
};

const Availability: React.FC<AvailabilityProps> = ({
  availability,
  setAvailability,
  overides,
  setOverides,
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
    <div className="flex flex-col gap-2 sm:gap-4 w-full">
      {daysOfWeek.map((day: string, dayIndex: number) => (
        <div key={day} className="flex items-start w-full gap-3 sm:gap-6 flex-wrap">
          <div className="flex items-center gap-2 w-[130px]">
            <input
              type="checkbox"
              checked={availability[day].enabled}
              onChange={() => toggleDay(day)}
              className="w-[18px]! h-[18px]!"
            />
            <span className="text-body-4 text-text-primary">{day}</span>
          </div>

          {availability[day].enabled && (
            <div className="flex flex-col gap-1 sm:gap-3">
              {availability[day].intervals.map(
                (interval: Interval, i: number) => {
                  const endOptions = getEndOptions(interval.start);
                  return (
                    <div
                      key={i + interval.start}
                      className="flex items-center gap-1 sm:gap-3"
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
                        <div className="border-none outline-none bg-white flex items-center justify-center">
                          <FaCirclePlus
                            color="#302f2e"
                            size={20}
                            onClick={() => addInterval(day)}
                            className="cursor-pointer"
                          />
                        </div>
                      ) : (
                        <div className="border-none outline-none bg-white flex items-center justify-center">
                          <FaCircleMinus
                            color="#302f2e"
                            size={20}
                            onClick={() => deleteInterval(day, i)}
                            className="cursor-pointer"
                          />
                        </div>
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
