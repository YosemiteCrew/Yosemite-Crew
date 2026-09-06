import React, { useId } from 'react';

import Field from '@/app/ui/Field';
import { Textarea } from '@/app/ui/Input';

type FormDescProps = {
  intype: string;
  inname?: string;
  value: string;
  inlabel: string;
  readonly?: boolean;
  disabled?: boolean;
  hint?: string;
  placeholder?: string;
  required?: boolean;
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
  disabled,
  hint,
  placeholder,
  required = true,
  error,
  className,
}: Readonly<FormDescProps>) => {
  const uid = useId();
  const messageId = error || hint ? `${uid}-message` : undefined;

  return (
    <Field
      htmlFor={uid}
      label={inlabel}
      hint={hint}
      error={error}
      messageId={messageId}
      disabled={disabled}
    >
      <Textarea
        name={inname}
        id={uid}
        value={value ?? ''}
        placeholder={placeholder ?? inlabel}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        autoComplete="off"
        readOnly={readonly}
        required={required}
        disabled={disabled}
        error={Boolean(error)}
        aria-describedby={messageId}
        className={className}
      />
    </Field>
  );
};

export default FormDesc;
