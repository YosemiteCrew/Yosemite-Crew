import React, { useId, useState } from 'react';
import { IoIosWarning } from 'react-icons/io';
import { IoEye, IoEyeOff } from 'react-icons/io5';

type FormInputPassProps = {
  intype: string;
  inname: string;
  value: string;
  inlabel: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
};

const FormInputPass = ({
  intype,
  inname,
  inlabel,
  value,
  onChange,
  autoComplete,
  onBlur,
  onFocus,
  error,
}: FormInputPassProps & { error?: string }) => {
  const uid = useId();
  const errorId = error ? `${uid}-error` : undefined;
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="w-full">
      <label
        htmlFor={uid}
        className="mb-1.5 block truncate text-[12.5px] font-semibold text-neutral-800"
      >
        {inlabel}
      </label>
      <div className="relative">
        <input
          type={showPassword ? 'text' : intype}
          name={inname}
          id={uid}
          value={value ?? ''}
          autoComplete={autoComplete}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          aria-label={inlabel}
          className={`
            h-[42px] w-full rounded-xl border-[1.5px] bg-[var(--field-bg)]
            pl-3.5 pr-11 text-[14px] text-text-primary outline-none transition-colors
            placeholder:text-input-text-placeholder
            disabled:cursor-not-allowed disabled:opacity-60
            ${error ? 'border-input-border-error!' : 'border-input-border-default!'}
            focus:border-input-border-active! focus:shadow-[0_0_0_3px_var(--glow-b10)]
          `}
        />
        <button
          type="button"
          onClick={togglePasswordVisibility}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer text-text-secondary hover:text-text-primary transition-colors"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          title={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <IoEyeOff size={20} /> : <IoEye size={20} />}
        </button>
      </div>

      {/* Show error as bottom red text only for input validation */}
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

export default FormInputPass;
