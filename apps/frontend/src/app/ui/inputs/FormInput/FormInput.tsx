import React, { useId } from 'react';

import Field from '@/app/ui/Field';
import Input from '@/app/ui/Input';

type FormInputProps = {
  intype: string;
  inname?: string;
  value: string;
  inlabel: string;
  readonly?: boolean;
  disabled?: boolean;
  hint?: string;
  placeholder?: string;
  required?: boolean;
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
  disabled,
  hint,
  placeholder,
  required = true,
  error,
  className,
  tabIndex,
}: Readonly<FormInputProps>) => {
  const uid = useId();
  const messageId = error || hint ? `${uid}-message` : undefined;

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    onClick?.(e);
    if (intype === 'time' || intype === 'date') {
      e.currentTarget.showPicker?.();
    }
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
      <Input
        type={intype}
        name={inname}
        id={uid}
        value={value ?? ''}
        placeholder={placeholder ?? inlabel}
        onChange={onChange}
        autoComplete="off"
        readOnly={readonly}
        required={required}
        disabled={disabled}
        tabIndex={tabIndex}
        error={Boolean(error)}
        aria-describedby={messageId}
        onFocus={onFocus}
        onBlur={onBlur}
        onClick={handleInputClick}
        className={className}
      />
    </Field>
  );
};

export default FormInput;
