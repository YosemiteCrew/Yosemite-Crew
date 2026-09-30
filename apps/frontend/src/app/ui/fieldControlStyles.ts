import clsx from 'clsx';

/**
 * Single-line field control height: 40px at desktop density, 44px on phones
 * (below `sm`) and on touch screens, so every field stays a comfortable tap
 * target where it is used with a finger.
 */
export const FIELD_CONTROL_HEIGHT = 'h-10 max-sm:h-11 pointer-coarse:h-11';

export const getFieldControlClassName = (error?: boolean) =>
  clsx(
    'w-full rounded-xl border bg-[var(--field-bg)] text-sm text-[var(--ink-body)] outline-none transition-colors placeholder:text-[var(--ink-faint)] focus:border-[var(--blue)] focus:shadow-[0_0_0_3px_var(--glow-b10)] disabled:cursor-not-allowed disabled:text-[var(--ink-muted)]',
    error ? 'border-[var(--danger)]' : 'border-[var(--hairline)]'
  );
