import type { ReactNode } from 'react';
import clsx from 'clsx';

export type FieldProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  error?: ReactNode;
  hint?: ReactNode;
  htmlFor: string;
  label?: ReactNode;
  messageId?: string;
};

const Field = ({
  children,
  className,
  disabled,
  error,
  hint,
  htmlFor,
  label,
  messageId,
}: Readonly<FieldProps>) => (
  <div className={clsx('flex w-full flex-col gap-2', className)}>
    {label != null && (
      <label
        htmlFor={htmlFor}
        className={clsx(
          'text-sm font-medium text-[var(--ink-body)]',
          disabled && 'text-[var(--ink-muted)]'
        )}
      >
        {label}
      </label>
    )}
    {children}
    {error ? (
      <span id={messageId} role="alert" className="text-xs text-[var(--danger-text)]">
        {error}
      </span>
    ) : (
      hint && (
        <span id={messageId} className="text-xs text-[var(--ink-muted)]">
          {hint}
        </span>
      )
    )}
  </div>
);

export default Field;
