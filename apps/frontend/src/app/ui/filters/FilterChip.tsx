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
  /**
   * Accessible name for the dot when it carries meaning beyond decoration — the
   * emergencies chip uses it to announce that emergencies are present. Without
   * it the dot stays aria-hidden.
   */
  dotLabel?: string;
  /** 'danger' keeps the chip danger-toned in both states, for the emergencies filter. */
  tone?: 'neutral' | 'danger';
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
};

// Rest / active pair per tone. Danger stays danger-toned when inactive too, so
// the emergencies chip reads as an emergency filter before it is pressed.
const TONE_CLASSNAMES = {
  neutral: {
    active:
      'border-[var(--chip-selected-border)]! bg-[var(--chip-selected-bg)] font-bold text-[var(--chip-selected-ink)]!',
    rest: 'border-[var(--hairline)]! bg-transparent font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]',
  },
  danger: {
    active:
      'border-[var(--danger-border)]! bg-[var(--danger-bg)] font-bold text-[var(--danger-text)]!',
    rest: 'border-[var(--danger-border)]! bg-transparent font-semibold text-[var(--danger-text)]! hover:border-[var(--danger-text)]!',
  },
} as const;

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
  dotLabel,
  tone = 'neutral',
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
      TONE_CLASSNAMES[tone][active ? 'active' : 'rest'],
      disabled && 'cursor-not-allowed opacity-60',
      className
    )}
  >
    {dotColor ? (
      <span
        aria-label={dotLabel}
        aria-hidden={dotLabel ? undefined : true}
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: dotColor }}
      />
    ) : null}
    <span>{label}</span>
    {typeof count === 'number' ? (
      /* The count inherits the chip's ink rather than naming a token, so it
         stays legible on the danger tone as well as the neutral one. No opacity
         on the active chip: the app-scope alias-closure test forbids
         compositing a faint ink under opacity, because that is what drops it
         below AA. On a solid selected fill the label ink is already legible, so
         the count simply shares it. */
      <span className={clsx('tabular-nums', active ? undefined : 'text-[var(--ink-faint)]')}>
        {count}
      </span>
    ) : null}
  </button>
);

export default FilterChip;
