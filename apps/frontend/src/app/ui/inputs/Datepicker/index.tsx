import React, { forwardRef, useId } from 'react';
import ReactDatePicker from 'react-datepicker';
import { IoIosWarning } from 'react-icons/io';
import { IoCalendarOutline } from 'react-icons/io5';

const INPUT_DATE_FORMAT = 'MMM d, yyyy';

type DatepickerProps = {
  currentDate: Date | null;
  setCurrentDate:
    | React.Dispatch<React.SetStateAction<Date | null>>
    | React.Dispatch<React.SetStateAction<Date>>;
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
  placeholder: string;
  className?: string;
  errorId?: string;
};

const DateInputButton = forwardRef<HTMLButtonElement, DateInputButtonProps>(
  function DateInputButton(
    { value, onClick, isIconOnly, inputId, placeholder, className, errorId },
    ref
  ) {
    const accessibleLabel = placeholder || 'Date';

    if (isIconOnly) {
      return (
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          className={`flex h-12 w-12 items-center justify-center rounded-2xl! border! border-input-border-default! transition-all duration-300 ease-in-out ${className ?? ''}`}
          aria-label="Toggle calendar"
          aria-describedby={errorId}
        >
          <IoCalendarOutline size={20} color="var(--color-primary-500)" aria-hidden="true" />
        </button>
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={`peer relative flex min-h-12 w-full items-center rounded-2xl! border bg-transparent px-5 py-2.5 text-left text-text-primary outline-none transition-colors ${className ?? ''}`}
        style={{ fontSize: 16 }}
        aria-label={
          value
            ? `${accessibleLabel}: ${value}, toggle calendar`
            : `${accessibleLabel}, toggle calendar`
        }
        aria-haspopup="dialog"
        aria-controls={inputId}
        aria-describedby={errorId}
      >
        <span>{value || ''}</span>
        <span
          className={`pointer-events-none absolute left-5 font-satoshi transition-all duration-150 ${
            value
              ? 'top-0 -translate-y-1/2 bg-(--whitebg) px-1 text-neutral-900'
              : 'top-1/2 -translate-y-1/2 text-input-text-placeholder'
          }`}
          style={{ fontSize: value ? 12 : 16 }}
        >
          {accessibleLabel}
        </span>
        <span className="absolute right-5 top-1/2 -translate-y-1/2">
          <IoCalendarOutline size={18} color="var(--color-primary-500)" aria-hidden="true" />
        </span>
      </button>
    );
  }
);

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
  const minDate = minDateProp ?? new Date(minYear, 0, 1);
  const maxDate = new Date(maxYear, 11, 31);
  const isInput = type === 'input';

  const handleDateChange = (date: Date | null) => {
    updateDate(date);
  };

  return (
    <div className={`relative ${containerClassName ?? ''}`}>
      <ReactDatePicker
        selected={currentDate}
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
        customInput={
          <DateInputButton
            isIconOnly={!isInput}
            inputId={inputId}
            placeholder={placeholder}
            errorId={errorId}
            className={`${error ? 'border-input-border-error!' : 'border-input-border-default!'} focus:border-input-border-active! ${className ?? ''}`}
          />
        }
      />

      {error && (
        <div
          id={errorId}
          role="alert"
          className="mt-1.5 flex items-center gap-1 px-4 text-caption-2 text-text-error"
        >
          <IoIosWarning className="text-text-error" size={14} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default Datepicker;
