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
  /** When set, bounds the field and shows the visitor how much they have used. */
  maxLength?: number;
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
  maxLength,
}: Readonly<FormDescProps>) => {
  const uid = useId();
  const messageId = error || hint ? `${uid}-message` : undefined;
  const countId = maxLength === undefined ? undefined : `${uid}-count`;
  /* Described rather than announced: a live region on a per-keystroke counter
     reads the whole number out again on every character typed. */
  const describedBy = [messageId, countId].filter(Boolean).join(' ') || undefined;

  return (
    <Field
      htmlFor={uid}
      label={inlabel}
      hint={hint}
      error={error}
      messageId={messageId}
      disabled={disabled}
    >
      <>
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
          maxLength={maxLength}
          aria-describedby={describedBy}
          className={className}
        />
        {countId && (
          <span id={countId} className="self-end text-xs text-[var(--ink-muted)]">
            {`${(value ?? '').length} of ${maxLength} characters`}
          </span>
        )}
      </>
    </Field>
  );
};

export default FormDesc;
