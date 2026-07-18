import React, { useId } from 'react';
import { IoIosWarning } from 'react-icons/io';

type FormDescProps = {
  intype: string;
  inname?: string;
  value: string;
  inlabel: string;
  readonly?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  error?: string;
  className?: string;
};

const FormDesc = ({
  inname,
  inlabel,
  value,
  onChange,
  onBlur,
  onFocus,
  readonly,
  error,
  className,
}: Readonly<FormDescProps>) => {
  const uid = useId();
  return (
    <div className="w-full">
      <label
        htmlFor={uid}
        className="mb-1.5 block truncate text-[12px] font-semibold text-neutral-800"
      >
        {inlabel}
      </label>
      <textarea
        name={inname}
        id={uid}
        value={value ?? ''}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        autoComplete="off"
        readOnly={readonly}
        required
        aria-label={inlabel}
        className={`
          min-h-[90px] w-full rounded-[13px] border-[1.5px] bg-[var(--field-bg)]
          px-[13px] py-[11px] text-[13.5px] leading-[1.5] text-text-primary outline-none transition-colors
          placeholder:text-input-text-placeholder
          disabled:cursor-not-allowed disabled:opacity-60
          ${error ? 'border-input-border-error!' : 'border-input-border-default!'}
          focus:border-input-border-active! focus:shadow-[0_0_0_3px_var(--glow-b10)]
          ${className ?? ''}
        `}
      />

      {error && (
        <div className="mt-1.5 flex items-center gap-1 text-caption-2 text-text-error">
          <IoIosWarning className="text-text-error" size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default FormDesc;
