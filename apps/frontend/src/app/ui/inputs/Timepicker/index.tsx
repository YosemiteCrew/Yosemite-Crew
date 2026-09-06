import React, { useId, useMemo } from 'react';
import ReactDatePicker from 'react-datepicker';
import { IoTimeOutline } from 'react-icons/io5';

import Field from '@/app/ui/Field';
import { getFieldControlClassName } from '@/app/ui/fieldControlStyles';

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
  inputId: string;
  error?: string;
  errorId?: string;
  className?: string;
  ref?: React.Ref<HTMLButtonElement>;
};

const TimeInputButton = ({
  value,
  onClick,
  label,
  inputId,
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
      id={inputId}
      className={`relative flex h-10 items-center justify-between px-3 text-left ${getFieldControlClassName(Boolean(error))} ${className ?? ''}`}
      aria-label={value ? `${label}: ${value}` : label}
      aria-haspopup="dialog"
      aria-describedby={error && errorId ? errorId : undefined}
    >
      <span className={`truncate ${value ? '' : 'text-[var(--ink-faint)]'}`} aria-hidden="true">
        {value || label}
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
  const inputId = useId();
  const errorId = error ? `${inputId}-error` : undefined;
  const customInput = useMemo(
    () => (
      <TimeInputButton
        value={value}
        label={label}
        inputId={inputId}
        error={error}
        errorId={errorId}
        className={className}
      />
    ),
    [value, label, inputId, error, errorId, className]
  );

  return (
    <Field htmlFor={inputId} label={label} error={error} messageId={errorId}>
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
    </Field>
  );
};

export default Timepicker;
