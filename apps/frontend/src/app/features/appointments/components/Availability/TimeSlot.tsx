import React, { useEffect, useRef, useState } from 'react';
import {
  AvailabilityState,
  getTimeLabelFromValue,
  Interval,
  TimeOption,
} from '@/app/features/appointments/components/Availability/utils';

type Field = keyof Interval;

interface TimeSlotProps {
  interval: Interval;
  timeOptions: TimeOption[];
  timeIndex: Map<string, number>;
  setAvailability: React.Dispatch<React.SetStateAction<AvailabilityState>>;
  day: string;
  intervalIndex: number;
  field: Field;
  disabled?: boolean;
}

const TimeSlot: React.FC<TimeSlotProps> = ({
  interval,
  timeOptions,
  timeIndex,
  setAvailability,
  day,
  intervalIndex,
  field,
  disabled = false,
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
      if (field === 'start' && interval.end && startIdx >= endIdx) {
        interval.end = '';
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative w-[100px] sm:w-[110px]" ref={availabilityContainerRef}>
      {/* 32px value chip: warm field fill, 1.5px hairline, 9px radius, tabular
          figures, and a blue ring while the picker is open/focused. */}
      <button
        type="button"
        className={`flex h-8 w-full items-center justify-center rounded-[9px]! border-[1.5px] bg-[var(--field-bg)] px-3 outline-none transition-shadow focus-visible:border-[var(--blue)] focus-visible:shadow-[0_0_0_3px_var(--glow-b10)] ${
          open
            ? 'border-[var(--blue)] shadow-[0_0_0_3px_var(--glow-b10)]'
            : 'border-[var(--hairline)]'
        }`}
        onClick={() => {
          if (disabled) return;
          setOpen((e: boolean) => !e);
        }}
        disabled={disabled}
      >
        <span className="text-[13px] font-semibold tabular-nums text-[var(--ink-body)]">
          {getTimeLabelFromValue(interval[field]) || 'Select'}
        </span>
      </button>
      {open && !disabled && (
        <div className="max-h-[200px] z-10 w-[110px] overflow-y-scroll scrollbar-hidden flex flex-col bg-neutral-0 rounded-2xl border border-card-border absolute left-0 top-[110%] p-2">
          {timeOptions.map((opt: TimeOption) => (
            <button
              type="button"
              key={opt.value}
              className="border-none outline-none bg-neutral-0 text-center py-2 hover:bg-card-hover! rounded-2xl! transition-all duration-300"
              onClick={() => handleTimeChange(opt.value)}
            >
              <span className="text-body-4 text-text-primary ">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TimeSlot;
