import React, { useState } from "react";
import { IoIosWarning } from "react-icons/io";
import Image from "next/image";

type FormInputPassProps = {
  intype: string;
  inname: string;
  value: string;
  inlabel: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

const FormInputPass = ({
  intype,
  inname,
  inlabel,
  value,
  onChange,
  error,
}: FormInputPassProps & { error?: string }) => {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="w-full">
      <div className="relative">
        <input
          type={showPassword ? "text" : intype}
          name={inname}
          id={inname}
          value={value ?? ""}
          autoComplete="new-password"
          onChange={onChange}
          required
          placeholder={""}
          className={`
            peer w-full min-h-12 rounded-2xl bg-transparent px-6 py-2.5
            text-body-4 text-text-primary
            outline-none border
            ${error ? "border-input-border-error!" : "border-input-border-default!"}
            focus:border-input-border-active!
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
        <Image
          aria-hidden
          src="https://d2il6osz49gpup.cloudfront.net/Images/eyes.png"
          alt="eyes"
          width={24}
          height={24}
          onClick={togglePasswordVisibility}
          className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer"
        />
      </div>

      {/* Show error as bottom red text only for input validation */}
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

export default FormInputPass;
