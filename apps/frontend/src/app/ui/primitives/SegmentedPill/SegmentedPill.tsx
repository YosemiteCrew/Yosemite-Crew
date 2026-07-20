import React from 'react';

export type SegmentedPillOption<T extends string> = {
  value: T;
  label: string;
};

/**
 * Segment sizes measured off the 19 July design frames:
 * - `sm` 5px 13px / 11.5px — settings preference pills and the phone controls.
 * - `md` 5px 14px / 12px — dashboard, specialities and chat controls.
 * - `lg` 6px 15px / 12.5px — main tab controls (inventory catalog, appointments).
 */
export type SegmentedPillSize = 'sm' | 'md' | 'lg';

type SegmentedPillProps<T extends string> = {
  options: ReadonlyArray<SegmentedPillOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  size?: SegmentedPillSize;
  /** Stretch the track to its container with equal-width segments (chat sidebar). */
  fullWidth?: boolean;
};

const SEGMENT_SIZE: Record<SegmentedPillSize, string> = {
  sm: 'px-[13px] py-[5px] text-[11.5px]',
  md: 'px-[14px] py-[5px] text-[12px]',
  lg: 'px-[15px] py-[6px] text-[12.5px]',
};

// Equal-width segments share the track, so the design drops the horizontal
// padding and keeps only the vertical pad.
const SEGMENT_SIZE_FULL_WIDTH: Record<SegmentedPillSize, string> = {
  sm: 'flex-1 text-center py-[5px] text-[11.5px]',
  md: 'flex-1 text-center py-[6px] text-[12px]',
  lg: 'flex-1 text-center py-[6px] text-[12.5px]',
};

type SegmentStyleArgs = {
  active: boolean;
  size: SegmentedPillSize;
  fullWidth: boolean;
  disabled?: boolean;
};

// Neutral raised-pill segmented control per the design recipe:
// track = --band + hairline, active segment = --screen raised (shadow), ink text.
const segmentClass = ({ active, size, fullWidth, disabled }: SegmentStyleArgs) =>
  `rounded-full! ${
    fullWidth ? SEGMENT_SIZE_FULL_WIDTH[size] : SEGMENT_SIZE[size]
  } transition-colors ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${
    active
      ? 'bg-[var(--screen)] font-bold text-[var(--ink)] shadow-[0_1px_3px_var(--sh08)]'
      : 'font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]'
  }`;

function SegmentedPill<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled,
  size = 'sm',
  fullWidth = false,
}: Readonly<SegmentedPillProps<T>>) {
  return (
    <div /* NOSONAR: styled inline-flex segmented control; native <fieldset> defaults (block layout, border, required legend) break the pill design */
      role="group"
      aria-label={ariaLabel}
      className={`${
        fullWidth ? 'flex w-full' : 'inline-flex'
      } items-center rounded-full! border border-[var(--hairline)] bg-[var(--band)] p-[3px] ${
        disabled ? 'opacity-70' : ''
      }`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={segmentClass({ active, size, fullWidth, disabled })}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedPill;
