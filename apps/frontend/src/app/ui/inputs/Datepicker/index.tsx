import React, { forwardRef, useId } from 'react';
import ReactDatePicker from 'react-datepicker';
import { IoIosWarning } from 'react-icons/io';
import { IoCalendarClear } from 'react-icons/io5';

const INPUT_DATE_FORMAT = 'MMM d, yyyy';

type DatepickerProps = {
  currentDate: Date | null;
  setCurrentDate:
    | React.Dispatch<React.SetStateAction<Date | null>>
    | React.Dispatch<React.SetStateAction<Date>>;
  minYear?: number;
  maxYear?: number;
  type?: string;
  className?: string;
  containerClassName?: string;
  placeholder: string;
  error?: string;
};

type DateInputButtonProps = {
  value?: string;
  onClick?: () => void;
  isIconOnly: boolean;
  inputId: string;
  placeholder: string;
  className?: string;
};

const DateInputButton = forwardRef<HTMLButtonElement, DateInputButtonProps>(
  function DateInputButton({ value, onClick, isIconOnly, inputId, placeholder, className }, ref) {
    if (isIconOnly) {
      return (
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          className="rounded-2xl! border! border-input-border-default! px-[13px] py-[13px] transition-all duration-300 ease-in-out"
          aria-label="Toggle calendar"
        >
          <IoCalendarClear size={20} color="#302f2e" />
        </button>
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={`peer relative flex min-h-12 w-full items-center rounded-2xl! border bg-transparent px-6 py-2.5 text-left text-body-4 text-text-primary outline-none transition-colors ${className ?? ''}`}
        aria-label="Toggle calendar"
        aria-haspopup="dialog"
        aria-controls={inputId}
      >
        <span>{value || ''}</span>
        <span
          className={`pointer-events-none absolute left-6 text-body-4 transition-all duration-200 ${
            value
              ? '-top-[11px] translate-y-0 bg-(--whitebg) px-1 text-sm! text-input-text-placeholder-active'
              : 'top-1/2 -translate-y-1/2 text-input-text-placeholder'
          }`}
        >
          {placeholder || 'Date of birth'}
        </span>
        <span className="absolute right-6 top-1/2 -translate-y-1/2">
          <IoCalendarClear size={20} color="#302f2e" />
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
  type = 'icon',
  className,
  containerClassName,
  placeholder,
  error,
}: DatepickerProps) => {
  const inputId = useId();
  const updateDate = setCurrentDate as React.Dispatch<React.SetStateAction<Date | null>>;
  const minDate = new Date(minYear, 0, 1);
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
        wrapperClassName={isInput ? 'w-full' : ''}
        customInput={
          <DateInputButton
            isIconOnly={!isInput}
            inputId={inputId}
            placeholder={placeholder}
            className={`${error ? 'border-input-border-error!' : 'border-input-border-default!'} focus:border-input-border-active! ${className ?? ''}`}
          />
        }
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

export default Datepicker;
