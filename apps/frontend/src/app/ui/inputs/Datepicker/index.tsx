import React, { useCallback, useId, useMemo, useRef } from 'react';
import ReactDatePicker from 'react-datepicker';
import { IoIosWarning } from 'react-icons/io';
import { IoCalendarOutline } from 'react-icons/io5';

const INPUT_DATE_FORMAT = 'MMM d, yyyy';

type DatepickerProps = {
  currentDate: Date | null;
  setCurrentDate:
    React.Dispatch<React.SetStateAction<Date | null>> | React.Dispatch<React.SetStateAction<Date>>;
  minYear?: number;
  maxYear?: number;
  /** Earliest selectable date. Overrides minYear when provided. */
  minDate?: Date;
  type?: string;
  className?: string;
  containerClassName?: string;
  placeholder: string;
  error?: string;
  /** Render the calendar popper via a body portal (prevents clipping inside overflow:hidden containers). */
  portal?: boolean;
};

type DateInputButtonProps = {
  value?: string;
  onClick?: () => void;
  isIconOnly: boolean;
  inputId: string;
  label: string;
  className?: string;
  errorId?: string;
  ref?: React.Ref<HTMLButtonElement>;
};

const DateInputButton = ({
  value,
  onClick,
  isIconOnly,
  inputId,
  label,
  className,
  errorId,
  ref,
}: DateInputButtonProps) => {
  const accessibleLabel = label || 'Date';

  if (isIconOnly) {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={`flex h-[46px] w-[46px] items-center justify-center rounded-[13px]! border-[1.5px]! bg-[var(--field-bg)] transition-all duration-300 ease-in-out focus:shadow-[0_0_0_3px_var(--glow-b10)] ${className ?? ''}`}
        aria-label="Toggle calendar"
        aria-describedby={errorId}
      >
        <IoCalendarOutline size={18} color="var(--color-primary-500)" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={`relative flex h-[46px] w-full items-center justify-between rounded-[13px]! border-[1.5px] bg-[var(--field-bg)] px-[13px] text-left text-[13.5px] text-text-primary outline-none transition-colors focus:shadow-[0_0_0_3px_var(--glow-b10)] ${className ?? ''}`}
      aria-label={
        value
          ? `${accessibleLabel}: ${value}, toggle calendar`
          : `${accessibleLabel}, toggle calendar`
      }
      aria-haspopup="dialog"
      aria-controls={inputId}
      aria-describedby={errorId}
    >
      <span className="truncate">{value || ''}</span>
      <IoCalendarOutline
        size={15}
        color="var(--color-neutral-600)"
        aria-hidden="true"
        className="ml-2 shrink-0"
      />
    </button>
  );
};

const getComparableDateTime = (date: Date | null | undefined) => {
  if (!(date instanceof Date)) return null;
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
};

const useStableDate = (date: Date | null | undefined) => {
  const dateRef = useRef<Date | null>(date ?? null);
  const time = getComparableDateTime(date);
  const previousTime = getComparableDateTime(dateRef.current);

  if (time !== previousTime) {
    dateRef.current = date ?? null;
  }

  return dateRef.current;
};

const Datepicker = ({
  currentDate,
  setCurrentDate,
  minYear = 1970,
  maxYear = 2100,
  minDate: minDateProp,
  type = 'icon',
  className,
  containerClassName,
  placeholder,
  error,
  portal = true,
}: DatepickerProps) => {
  const inputId = useId();
  const errorId = error ? `${inputId}-error` : undefined;
  const updateDate = setCurrentDate as React.Dispatch<React.SetStateAction<Date | null>>;
  const selectedDate = useStableDate(currentDate);
  const stableMinDateProp = useStableDate(minDateProp);
  const minDate = useMemo(
    () => stableMinDateProp ?? new Date(minYear, 0, 1),
    [minYear, stableMinDateProp]
  );
  const maxDate = useMemo(() => new Date(maxYear, 11, 31), [maxYear]);
  const isInput = type === 'input';

  const handleDateChange = useCallback(
    (date: Date | null) => {
      updateDate(date);
    },
    [updateDate]
  );
  const customInput = useMemo(
    () => (
      <DateInputButton
        isIconOnly={!isInput}
        inputId={inputId}
        label={placeholder}
        errorId={errorId}
        className={`${error ? 'border-input-border-error!' : 'border-input-border-default!'} focus:border-input-border-active! ${className ?? ''}`}
      />
    ),
    [className, error, errorId, inputId, isInput, placeholder]
  );

  return (
    <div className={`relative ${containerClassName ?? ''}`}>
      {isInput && (
        <span className="mb-1.5 block truncate text-[12px] font-semibold text-neutral-800">
          {placeholder}
        </span>
      )}
      <ReactDatePicker
        selected={selectedDate}
        onChange={handleDateChange}
        minDate={minDate}
        maxDate={maxDate}
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        dateFormat={INPUT_DATE_FORMAT}
        fixedHeight
        shouldCloseOnSelect
        popperPlacement={isInput ? 'bottom-start' : 'bottom-end'}
        showPopperArrow={false}
        calendarClassName="yc-datepicker-calendar"
        popperClassName="yc-datepicker-popper"
        portalId={portal ? 'yc-datepicker-portal' : undefined}
        wrapperClassName={isInput ? 'w-full' : ''}
        customInput={customInput}
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

const areDatepickerPropsEqual = (prev: DatepickerProps, next: DatepickerProps) =>
  getComparableDateTime(prev.currentDate) === getComparableDateTime(next.currentDate) &&
  getComparableDateTime(prev.minDate) === getComparableDateTime(next.minDate) &&
  prev.minYear === next.minYear &&
  prev.maxYear === next.maxYear &&
  prev.type === next.type &&
  prev.className === next.className &&
  prev.containerClassName === next.containerClassName &&
  prev.placeholder === next.placeholder &&
  prev.error === next.error &&
  prev.portal === next.portal;

export default React.memo(Datepicker, areDatepickerPropsEqual);
