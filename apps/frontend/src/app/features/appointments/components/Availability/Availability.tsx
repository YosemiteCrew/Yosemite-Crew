import React, { useMemo } from 'react';
import {
  daysOfWeek,
  DEFAULT_INTERVAL,
  AvailabilityState,
  TimeOption,
  Interval,
  SetAvailability,
  buildTimeIndex,
  generateTimeOptions,
} from '@/app/features/appointments/components/Availability/utils';
import TimeSlot from '@/app/features/appointments/components/Availability/TimeSlot';
import { IoAdd, IoClose } from 'react-icons/io5';
import Dublicate from '@/app/features/appointments/components/Availability/Dublicate';

type AvailabilityProps = {
  availability: AvailabilityState;
  setAvailability: SetAvailability;
  twoColumnLayout?: boolean;
  readOnly?: boolean;
};

/**
 * 36x22 pill switch — blue track with the knob to the right when the day is on,
 * warm band track with a hairline outline and the knob to the left when it is off.
 * The native checkbox stays as the (visually hidden) a11y control.
 */
const DayToggle = ({
  day,
  checked,
  disabled,
  onToggle,
}: {
  day: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) => (
  <label className={`relative inline-flex shrink-0 ${disabled ? '' : 'cursor-pointer'}`}>
    <input
      type="checkbox"
      aria-label={`Enable availability for ${day}`}
      checked={checked}
      onChange={() => {
        if (disabled) return;
        onToggle();
      }}
      disabled={disabled}
      className="absolute size-full cursor-[inherit] opacity-0"
    />
    <span
      aria-hidden="true"
      className="pointer-events-none block h-[22px] w-9 rounded-full border transition-colors duration-150"
      style={{
        background: checked ? 'var(--blue)' : 'var(--band)',
        borderColor: checked ? 'var(--blue)' : 'var(--divider)',
      }}
    >
      <span
        className="absolute top-[3px] size-4 rounded-full transition-all duration-150"
        style={{
          left: checked ? '17px' : '3px',
          background: checked ? '#ffffff' : 'var(--screen)',
          boxShadow: '0 1px 2px var(--sh08)',
        }}
      />
    </span>
  </label>
);

/** 28px outlined circle action — the design's add-range / copy-to-other-days chrome. */
const CircleAction = ({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className="flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors"
    style={{ borderColor: 'var(--hairline)', color: 'var(--ink-faint)' }}
  >
    {children}
  </button>
);

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

  // Table-style row: toggle | day name | ranges | actions, separated by a hairline
  // rule inside one card. The row being edited lifts onto the soft warm wash.
  const renderDayRow = (day: string) => {
    const { enabled, intervals } = availability[day];
    return (
      <div
        key={day}
        className="grid break-inside-avoid grid-cols-[40px_96px_1fr_auto] items-center gap-3.5 border-t px-6 py-3 transition-colors focus-within:bg-[var(--surface-soft)]"
        style={{ borderTopColor: 'var(--hairline)' }}
      >
        <DayToggle
          day={day}
          checked={enabled}
          disabled={readOnly}
          onToggle={() => toggleDay(day)}
        />
        <span
          className="truncate text-[13.5px] leading-[120%]"
          style={{
            color: enabled ? 'var(--ink)' : 'var(--ink-faint)',
            fontWeight: enabled ? 700 : 600,
          }}
        >
          {day}
        </span>

        {enabled ? (
          <div className="flex flex-wrap items-center gap-2">
            {intervals.map((interval: Interval, i: number) => {
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
                  {!readOnly && i > 0 && (
                    <button
                      type="button"
                      aria-label={`Remove range ${i + 1} for ${day}`}
                      title="Remove range"
                      onClick={() => deleteInterval(day, i)}
                      className="flex size-6 shrink-0 items-center justify-center rounded-full"
                      style={{ color: 'var(--ink-faint)' }}
                    >
                      <IoClose size={13} aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <span className="text-[12.5px]" style={{ color: 'var(--ink-faint)' }}>
            Day off
          </span>
        )}

        <div className="flex items-center gap-2">
          {enabled && !readOnly && (
            <>
              <CircleAction label={`Add range for ${day}`} onClick={() => addInterval(day)}>
                <IoAdd size={14} aria-hidden="true" />
              </CircleAction>
              <Dublicate setAvailability={setAvailability} day={day} />
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={twoColumnLayout ? 'w-full columns-1 md:columns-2 [column-gap:0.75rem]' : 'w-full'}
    >
      {daysOfWeek.map(renderDayRow)}
    </div>
  );
};

export default Availability;
