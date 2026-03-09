import React from 'react';
import {
  daysOfWeek,
  DEFAULT_INTERVAL,
  AvailabilityState,
  TimeOption,
  Interval,
  SetAvailability,
  ApiOverrides,
  buildTimeIndex,
  generateTimeOptions,
} from '@/app/features/appointments/components/Availability/utils';
import TimeSlot from '@/app/features/appointments/components/Availability/TimeSlot';
import { FaCirclePlus, FaCircleMinus } from 'react-icons/fa6';
import Dublicate from '@/app/features/appointments/components/Availability/Dublicate';
import { useMemo } from 'react';

type AvailabilityProps = {
  availability: AvailabilityState;
  setAvailability: SetAvailability;
  overides?: ApiOverrides[];
  setOverides?: React.Dispatch<React.SetStateAction<ApiOverrides[]>>;
  twoColumnLayout?: boolean;
  readOnly?: boolean;
};

const Availability: React.FC<AvailabilityProps> = ({
  availability,
  setAvailability,
  twoColumnLayout = false,
  readOnly = false,
}) => {
  const timeOptions = useMemo(() => generateTimeOptions(), []);
  const timeIndex = useMemo(() => buildTimeIndex(timeOptions), [timeOptions]);

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

  const renderDayCard = (day: string) => (
    <div
      key={day}
      className="mb-3 break-inside-avoid rounded-2xl border border-card-border bg-white p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <input
            type="checkbox"
            checked={availability[day].enabled}
            onChange={() => {
              if (readOnly) return;
              toggleDay(day);
            }}
            disabled={readOnly}
            className="w-[18px]! h-[18px]!"
          />
          <span className="text-body-4 text-text-primary truncate">{day}</span>
        </div>
        {availability[day].enabled && !readOnly && (
          <Dublicate setAvailability={setAvailability} day={day} />
        )}
      </div>

      {availability[day].enabled && (
        <div className="mt-2 flex flex-wrap gap-2">
          {availability[day].intervals.map((interval: Interval, i: number) => {
            const endOptions = getEndOptions(interval.start);
            return (
              <div key={i + interval.start} className="inline-flex items-center gap-2">
                <TimeSlot
                  interval={interval}
                  timeOptions={timeOptions}
                  timeIndex={timeIndex}
                  setAvailability={setAvailability}
                  day={day}
                  intervalIndex={i}
                  field="start"
                  disabled={readOnly}
                />
                <TimeSlot
                  interval={interval}
                  timeOptions={endOptions}
                  timeIndex={timeIndex}
                  setAvailability={setAvailability}
                  day={day}
                  intervalIndex={i}
                  field="end"
                  disabled={readOnly}
                />
                {readOnly ? null : i === 0 ? (
                  <div className="border-none outline-none bg-white flex items-center justify-center shrink-0">
                    <FaCirclePlus
                      color="#302f2e"
                      size={20}
                      onClick={() => addInterval(day)}
                      className="cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="border-none outline-none bg-white flex items-center justify-center shrink-0">
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
          })}
        </div>
      )}
    </div>
  );

  return (
    <div
      className={twoColumnLayout ? 'w-full columns-1 md:columns-2 [column-gap:0.75rem]' : 'w-full'}
    >
      {daysOfWeek.map(renderDayCard)}
    </div>
  );
};

export default Availability;
