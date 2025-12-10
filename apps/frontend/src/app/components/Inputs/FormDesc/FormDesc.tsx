import React, { useState } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";

import "./FormDesc.css";

type FormDescProps = {
  intype: string;
  inname?: string;
  value: string;
  inlabel: string;
  readonly?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string;
  className?: string;
};

const FormDesc = ({
  intype,
  inname,
  inlabel,
  value,
  onChange,
  onBlur,
  readonly,
  error,
  className
}: Readonly<FormDescProps>) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="w-100">
      <div
        className={`SignInput floating-input-desc ${isFocused || value ? "focused" : ""}`}
      >
        <textarea
          name={inname}
          id={inname}
          value={value ?? ""}
          onChange={onChange}
          autoComplete="off"
          readOnly={readonly}
          required
          placeholder=" "
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
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

export default FormDesc;
