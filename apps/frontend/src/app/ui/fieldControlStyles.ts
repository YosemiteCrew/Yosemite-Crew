import clsx from 'clsx';

export const getFieldControlClassName = (error?: boolean) =>
  clsx(
    'w-full rounded-xl border bg-[var(--field-bg)] text-sm text-[var(--ink-body)] outline-none transition-colors placeholder:text-[var(--ink-faint)] focus:border-[var(--blue)] focus:shadow-[0_0_0_3px_var(--glow-b10)] disabled:cursor-not-allowed disabled:text-[var(--ink-muted)]',
    error ? 'border-[var(--danger)]' : 'border-[var(--hairline)]'
  );
