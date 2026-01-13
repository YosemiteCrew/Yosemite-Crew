import React from "react";
import { IoIosWarning } from "react-icons/io";

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
  return (
    <div className="w-full">
      <div className="relative">
        <input
          type={intype}
          name={inname}
          id={inname}
          value={value ?? ""}
          onChange={onChange}
          autoComplete="off"
          readOnly={readonly}
          required
          placeholder=" "
          tabIndex={tabIndex}
          onFocus={onFocus}
          onBlur={onBlur}
          onClick={onClick}
          className={`
            peer w-full min-h-12 rounded-2xl bg-transparent px-6 py-2.5
            text-body-4 text-text-primary
            outline-none border
            ${error ? "border-input-border-error!" : "border-input-border-default!"}
            focus:border-input-border-active!
            ${className ?? ""}
          `}
        />
        <label
          htmlFor={inname}
          className={`
            pointer-events-none absolute left-6
            top-1/2 -translate-y-1/2
            text-body-4 text-input-text-placeholder
            transition-all duration-200
            peer-focus:-top-[11px] peer-focus:translate-y-0
            peer-focus:text-sm!
            peer-focus:text-input-text-placeholder-active
            peer-focus:bg-(--whitebg)
            peer-focus:px-1 peer-not-placeholder-shown:px-1
            peer-not-placeholder-shown:-top-[11px] peer-not-placeholder-shown:translate-y-0
            peer-not-placeholder-shown:text-sm!
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

export default FormInput;
