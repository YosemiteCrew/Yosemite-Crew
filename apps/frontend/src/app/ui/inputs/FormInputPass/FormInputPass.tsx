import React, { useId, useState } from 'react';
import { IoEye, IoEyeOff } from 'react-icons/io5';

import Field from '@/app/ui/Field';
import Input from '@/app/ui/Input';

type FormInputPassProps = {
  intype: string;
  inname: string;
  value: string;
  inlabel: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  disabled?: boolean;
  hint?: string;
  placeholder?: string;
  required?: boolean;
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
  disabled,
  hint,
  placeholder,
  required = true,
  onBlur,
  onFocus,
  error,
}: FormInputPassProps & { error?: string }) => {
  const uid = useId();
  const messageId = error || hint ? `${uid}-message` : undefined;
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Field
      htmlFor={uid}
      label={inlabel}
      hint={hint}
      error={error}
      messageId={messageId}
      disabled={disabled}
    >
      <div className="relative">
        <Input
          type={showPassword ? 'text' : intype}
          name={inname}
          id={uid}
          value={value ?? ''}
          placeholder={placeholder ?? inlabel}
          autoComplete={autoComplete}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          required={required}
          disabled={disabled}
          error={Boolean(error)}
          aria-describedby={messageId}
          className="pr-11"
        />
        <button
          type="button"
          onClick={togglePasswordVisibility}
          className="absolute right-[13px] top-1/2 -translate-y-1/2 cursor-pointer text-text-secondary hover:text-text-primary transition-colors"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          title={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <IoEyeOff size={18} /> : <IoEye size={18} />}
        </button>
      </div>
    </Field>
  );
};

export default FormInputPass;
