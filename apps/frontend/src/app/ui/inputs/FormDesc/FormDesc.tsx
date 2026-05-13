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
      <div className={`relative`}>
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
          placeholder=" "
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
            pointer-events-none absolute left-5
            top-3.5 translate-y-0
            text-body-4 text-input-text-placeholder
            transition-all duration-200
            peer-focus:top-0 peer-focus:-translate-y-1/2
            peer-focus:text-xs!
            peer-focus:text-neutral-900
            peer-focus:bg-(--whitebg)
            peer-focus:px-1 peer-not-placeholder-shown:px-1
            peer-not-placeholder-shown:top-0 peer-not-placeholder-shown:-translate-y-1/2
            peer-not-placeholder-shown:text-xs!
            peer-not-placeholder-shown:text-neutral-900
            peer-not-placeholder-shown:bg-(--whitebg)
          `}
        >
          {inlabel}
        </label>
      </div>

      {error && (
        <div
          className={`
            mt-1.5 flex items-center gap-1 px-4
            text-caption-2 text-text-error
          `}
        >
          <IoIosWarning className="text-text-error" size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default FormDesc;
