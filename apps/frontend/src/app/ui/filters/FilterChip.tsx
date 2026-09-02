import React from 'react';
import clsx from 'clsx';

export type FilterChipProps = {
  label: string;
  active: boolean;
  onClick: () => void;
  /** Optional count rendered inside the chip, so the row needs no separate tab-with-count variant. */
  count?: number;
  /** Optional leading status dot colour (a CSS colour or token), e.g. the emergencies marker. */
  dotColor?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
};

/**
 * The one filter-chip recipe for list toolbars (design: Filters card).
 * Sentence case, 12.5px, pill, hairline outline at rest; the active chip is the
 * solid ink pill (--chip-selected-*). Counts live inside the chip. It replaces
 * the ALL-CAPS status pills that Templates and Finance used as filters, which
 * made a filter row read as a row of statuses.
 */
const FilterChip = ({
  label,
  active,
  onClick,
  count,
  dotColor,
  disabled,
  className,
  'aria-label': ariaLabel,
}: FilterChipProps) => (
  <button
    type="button"
    aria-pressed={active}
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={onClick}
    className={clsx(
      'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full! border px-[13px] text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]',
      active
        ? 'border-[var(--chip-selected-border)]! bg-[var(--chip-selected-bg)] font-bold text-[var(--chip-selected-ink)]!'
        : 'border-[var(--hairline)]! bg-transparent font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]',
      disabled && 'cursor-not-allowed opacity-60',
      className
    )}
  >
    {dotColor ? (
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: dotColor }}
      />
    ) : null}
    <span>{label}</span>
    {typeof count === 'number' ? (
      <span
        className={clsx(
          'tabular-nums',
          active ? 'text-[var(--chip-selected-ink)]/70' : 'text-[var(--ink-faint)]'
        )}
      >
        {count}
      </span>
    ) : null}
  </button>
);

export default FilterChip;
