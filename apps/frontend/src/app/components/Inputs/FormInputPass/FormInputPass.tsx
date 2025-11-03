import React, { useState } from "react";

import "./FormInputPass.css";
import { Icon } from "@iconify/react/dist/iconify.js";
import Image from "next/image";
import { Button } from "react-bootstrap";

type FormInputPassProps = {
  intype: string;
  inname: string;
  value: string;
  inlabel: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inPlaceHolder?: string;
};

const FormInputPass = ({
  intype,
  inname,
  inlabel,
  value,
  onChange,
  error,
  inPlaceHolder,
}: FormInputPassProps & { error?: string }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="w-100">
      <div
        className={`SignPassInput floating-input ${isFocused || value ? "focused" : ""}`}
      >
        <input
          type={showPassword ? "text" : intype}
          name={inname}
          id={inname}
          value={value ?? ""}
          autoComplete="new-password"
          onChange={onChange}
          required
          placeholder={isFocused ? inPlaceHolder : ""}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={error ? "is-invalid" : ""}
        />
        <label htmlFor={inname}>{inlabel}</label>
        <Button type="button" onClick={togglePasswordVisibility} tabIndex={-1}>
          <Image
            aria-hidden
            src="https://d2il6osz49gpup.cloudfront.net/Images/eyes.png"
            alt="eyes"
            width={24}
            height={24}
          />
        </Button>
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

export default FormInputPass;