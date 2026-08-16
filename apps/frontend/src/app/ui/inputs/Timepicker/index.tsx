import React, { useId, useMemo } from 'react';
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
  errorId?: string;
  className?: string;
  ref?: React.Ref<HTMLButtonElement>;
};

const TimeInputButton = ({
  value,
  onClick,
  label,
  error,
  errorId,
  className,
  ref,
}: TimeInputButtonProps) => {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={`relative flex h-[44px] w-full items-center justify-between rounded-[12px]! border-[1.5px] bg-[var(--field-bg)] px-[14px] text-left text-[14px] text-[var(--ink-body)] outline-none transition-colors focus:shadow-[0_0_0_3px_var(--glow-b10)] ${
        error ? 'border-[var(--danger)]!' : 'border-[var(--hairline)]!'
      } focus:border-[var(--blue)]! ${className ?? ''}`}
      aria-label={value ? `${label}: ${value}` : label}
      aria-haspopup="dialog"
      aria-describedby={error && errorId ? errorId : undefined}
    >
      <span className="truncate" aria-hidden="true">
        {value || ''}
      </span>
      <IoTimeOutline
        size={16}
        color="var(--ink-faint)"
        aria-hidden="true"
        className="ml-2 shrink-0"
      />
    </button>
  );
};

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
  const errorId = useId();
  const customInput = useMemo(
    () => (
      <TimeInputButton
        value={value}
        label={label}
        error={error}
        errorId={error ? errorId : undefined}
        className={className}
      />
    ),
    [value, label, error, errorId, className]
  );

  return (
    <div className="w-full">
      <span className="mb-1.5 block truncate text-[12.5px] font-semibold text-[var(--ink-soft)]">
        {label}
      </span>
      <ReactDatePicker
        selected={selectedTime}
        onChange={(nextValue) => {
          onChange(nextValue ? formatTimeString(nextValue) : '');
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
        portalId="yc-datepicker-portal"
        wrapperClassName="w-full"
        customInput={customInput}
        id={name}
      />

      {error && (
        <div
          id={errorId}
          role="alert"
          className="mt-1.5 flex items-center gap-1 text-caption-2 text-text-error"
        >
          <IoIosWarning className="text-text-error" size={14} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default Timepicker;
