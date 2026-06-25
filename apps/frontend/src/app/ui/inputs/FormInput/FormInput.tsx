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
  const hasValue = String(value ?? '').length > 0;
  const valueFloatingClass = hasValue
    ? 'px-1.5 max-w-none -top-[11px] translate-y-0 text-xs! bg-(--whitebg)'
    : '';

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    onClick?.(e);
    if (intype === 'time' || intype === 'date') {
      e.currentTarget.showPicker?.();
    }
  };

  return (
    <div className="w-full">
      <div className="relative">
        <input
          type={intype}
          name={inname}
          id={uid}
          value={value ?? ''}
          onChange={onChange}
          autoComplete="off"
          readOnly={readonly}
          required
          placeholder=" "
          tabIndex={tabIndex}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          aria-label={inlabel}
          onFocus={onFocus}
          onBlur={onBlur}
          onClick={handleInputClick}
          className={`
            peer w-full min-h-12 rounded-2xl bg-transparent px-6 py-2.5
            text-body-4 text-text-primary
            outline-none border
            ${error ? 'border-input-border-error!' : 'border-input-border-default!'}
            focus:border-input-border-active!
            ${className ?? ''}
          `}
        />
        <label
          htmlFor={uid}
          className={`
            pointer-events-none absolute left-4
            top-1/2 -translate-y-1/2
            max-w-[calc(100%-2rem)] truncate
            text-body-4 text-input-text-placeholder
            transition-all duration-200
            peer-focus:-top-[11px] peer-focus:translate-y-0
            peer-focus:text-xs!
            peer-focus:text-input-text-placeholder-active
            peer-focus:bg-(--whitebg)
            peer-focus:px-1.5 peer-focus:max-w-none
            peer-not-placeholder-shown:px-1.5 peer-not-placeholder-shown:max-w-none
            peer-not-placeholder-shown:-top-[11px] peer-not-placeholder-shown:translate-y-0
            peer-not-placeholder-shown:text-xs!
            peer-not-placeholder-shown:bg-(--whitebg)
            ${valueFloatingClass}
          `}
        >
          {inlabel}
        </label>
      </div>

      {error && (
        <div
          id={errorId}
          role="alert"
          className={`
            mt-1.5 flex items-center gap-1 px-4
            text-caption-2 text-text-error
          `}
        >
          <IoIosWarning className="text-text-error" size={14} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default FormInput;
