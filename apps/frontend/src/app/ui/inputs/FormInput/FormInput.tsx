import React, { useId } from 'react';
import { IoIosWarning } from 'react-icons/io';

type FormInputProps = {
  intype: string;
  inname?: string;
  value: string;
  inlabel: string;
  readonly?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
  error?: string;
  className?: string;
  tabIndex?: number;
};

const FormInput = ({
  intype,
  inname,
  inlabel,
  value,
  onChange,
  onBlur,
  onFocus,
  onClick,
  readonly,
  error,
  className,
  tabIndex,
}: Readonly<FormInputProps>) => {
  const uid = useId();
  const errorId = error ? `${uid}-error` : undefined;

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    onClick?.(e);
    if (intype === 'time' || intype === 'date') {
      e.currentTarget.showPicker?.();
    }
  };

  return (
    <div className="w-full">
      <label
        htmlFor={uid}
        className="mb-1.5 block truncate text-[12.5px] font-semibold text-[var(--ink-soft)]"
      >
        {inlabel}
      </label>
      <input
        type={intype}
        name={inname}
        id={uid}
        value={value ?? ''}
        onChange={onChange}
        autoComplete="off"
        readOnly={readonly}
        required
        tabIndex={tabIndex}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        aria-label={inlabel}
        onFocus={onFocus}
        onBlur={onBlur}
        onClick={handleInputClick}
        className={`
          h-[44px] w-full rounded-[12px] border-[1.5px] bg-[var(--field-bg)]
          px-[14px] text-[14px] text-[var(--ink-body)] outline-none transition-colors
          placeholder:text-[var(--ink-faint)]
          disabled:cursor-not-allowed disabled:opacity-60
          ${error ? 'border-[var(--danger)]!' : 'border-[var(--hairline)]!'}
          focus:border-[var(--blue)]! focus:shadow-[0_0_0_3px_var(--glow-b10)]
          ${className ?? ''}
        `}
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

export default FormInput;
