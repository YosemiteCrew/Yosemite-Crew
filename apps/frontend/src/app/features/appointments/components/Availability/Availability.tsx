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
      /* 40x24, the design system's `.switch`. This was 36x22 with a 16px knob,
         one of six sizes the same control shipped at. Geometry only: the
         control stays a real checkbox inside its label rather than becoming a
         button, so it keeps native form semantics. */
      className="pointer-events-none block h-6 w-10 rounded-full border transition-colors duration-150"
      style={{
        background: checked ? 'var(--blue)' : 'var(--band)',
        borderColor: checked ? 'var(--blue)' : 'var(--divider)',
      }}
    >
      <span
        className="absolute top-[3px] size-[18px] rounded-full transition-all duration-150"
        style={{
          left: checked ? '19px' : '3px',
          /* Fixed white in both states: --screen flips with the theme, so the
             off knob was #2f271e on a #3a3128 track in espresso, a contrast of
             1.15, and simply vanished. */
          background: '#ffffff',
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
  //
  // The four columns need 40 + 96 + 208 (two 100px time chips and their gap) +
  // 64 (two 28px circles) plus gaps and padding - about 500px, which ran the Add
  // and Duplicate buttons clean off a 390px screen. They are the only way to add
  // a second range or copy a day, so on a phone the row was not merely clipped,
  // it was unusable. Below `sm` the ranges drop to their own line underneath and
  // the actions stay on the first one, next to the day they act on.
  const renderDayRow = (day: string) => {
    const { enabled, intervals } = availability[day];
    return (
      <div
        key={day}
        className="grid break-inside-avoid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2.5 border-t px-4 py-3 transition-colors focus-within:bg-[var(--surface-soft)] sm:grid-cols-[40px_96px_minmax(0,1fr)_auto] sm:gap-3.5 sm:px-6"
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
          <div className="col-start-2 col-end-4 row-start-2 flex flex-wrap items-center gap-2 sm:col-auto sm:row-auto">
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
          /* A closed day has no ranges and no actions, so it does not need the
             second line the ranges take - it sits on the first one, in the
             column the action circles would have used. */
          <span
            className="col-start-3 row-start-1 justify-self-end text-[12.5px] sm:col-auto sm:row-auto sm:justify-self-auto"
            style={{ color: 'var(--ink-faint)' }}
          >
            Day off
          </span>
        )}

        <div className="col-start-3 row-start-1 flex items-center justify-end gap-2 sm:col-auto sm:row-auto">
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
