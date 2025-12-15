import React, { useState } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";

import "./FormInput.css";

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
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="w-100">
      <div
        className={`SignInput floating-input ${isFocused || value ? "focused" : ""}`}
      >
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
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e as React.ChangeEvent<HTMLInputElement>);
          }}
          onClick={onClick}
          tabIndex={tabIndex}
          className={`${error ? "is-invalid" : ""} ${className}`}
        />
        <label htmlFor={inname}>{inlabel}</label>
      </div>
      {/* Show error as bottom red text only for input validation */}
      {error && (
        <div className="Errors">
          <Icon icon="mdi:error" width="16" height="16" />
          {error}
        </div>
      )}
    </div>
  );
};

export default FormInput;
