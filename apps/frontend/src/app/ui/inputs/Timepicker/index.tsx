import React, { forwardRef, useMemo } from 'react';
import ReactDatePicker from 'react-datepicker';
import { IoIosWarning } from 'react-icons/io';
import { IoTimeOutline } from 'react-icons/io5';

type TimepickerProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  name?: string;
  error?: string;
  className?: string;
  minuteInterval?: number;
};

type TimeInputButtonProps = {
  value?: string;
  onClick?: () => void;
  label: string;
  error?: string;
  className?: string;
};

const TimeInputButton = forwardRef<HTMLButtonElement, TimeInputButtonProps>(
  function TimeInputButton({ value, onClick, label, error, className }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={`peer relative flex min-h-12 w-full items-center rounded-2xl! border bg-transparent px-6 py-2.5 text-left text-body-4 text-text-primary outline-none transition-colors ${
          error ? 'border-input-border-error!' : 'border-input-border-default!'
        } focus:border-input-border-active! ${className ?? ''}`}
        aria-label={label}
        aria-haspopup="dialog"
      >
        <span>{value || ''}</span>
        <span
          className={`pointer-events-none absolute left-6 text-body-4 transition-all duration-200 ${
            value
              ? '-top-[11px] translate-y-0 bg-(--whitebg) px-1 text-sm! text-input-text-placeholder-active'
              : 'top-1/2 -translate-y-1/2 text-input-text-placeholder'
          }`}
        >
          {label}
        </span>
        <span className="absolute right-6 top-1/2 -translate-y-1/2">
          <IoTimeOutline size={20} color="#302f2e" />
        </span>
      </button>
    );
  }
);

const toDateFromTimeString = (value: string): Date | null => {
  if (!value) return null;
  const [hourRaw, minuteRaw] = value.split(':');
  const hours = Number.parseInt(hourRaw ?? '', 10);
  const minutes = Number.parseInt(minuteRaw ?? '', 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  const parsedDate = new Date(2000, 0, 1, hours, minutes, 0, 0);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate;
};

const formatTimeString = (value: Date): string => {
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const Timepicker = ({
  value,
  onChange,
  label,
  name,
  error,
  className,
  minuteInterval = 5,
}: TimepickerProps) => {
  const selectedTime = useMemo(() => toDateFromTimeString(value), [value]);

  return (
    <div className="w-full">
      <ReactDatePicker
        selected={selectedTime}
        onChange={(nextValue) => {
          if (!nextValue) {
            onChange('');
            return;
          }
          onChange(formatTimeString(nextValue));
        }}
        showTimeSelect
        showTimeSelectOnly
        timeIntervals={minuteInterval}
        timeFormat="h:mm aa"
        dateFormat="HH:mm"
        shouldCloseOnSelect
        showPopperArrow={false}
        popperPlacement="bottom-start"
        calendarClassName="yc-datepicker-calendar"
        popperClassName="yc-datepicker-popper"
        wrapperClassName="w-full"
        customInput={
          <TimeInputButton value={value} label={label} error={error} className={className} />
        }
        id={name}
      />

      {error && (
        <div className="mt-1.5 flex items-center gap-1 px-4 text-caption-2 text-text-error">
          <IoIosWarning className="text-text-error" size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default Timepicker;
