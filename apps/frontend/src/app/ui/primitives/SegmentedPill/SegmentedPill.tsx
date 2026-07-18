import React from 'react';

export type SegmentedPillOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedPillProps<T extends string> = {
  options: ReadonlyArray<SegmentedPillOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
};

// Neutral raised-pill segmented control per the design recipe:
// track = --band + hairline, active segment = --screen raised (shadow), ink text.
const segmentClass = (active: boolean, disabled?: boolean) =>
  `rounded-full! px-3.5 py-1.5 text-[12px] transition-colors ${
    disabled ? 'cursor-not-allowed' : 'cursor-pointer'
  } ${
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
}: Readonly<SegmentedPillProps<T>>) {
  return (
    <div /* NOSONAR: styled inline-flex segmented control; native <fieldset> defaults (block layout, border, required legend) break the pill design */
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex items-center rounded-full! border border-[var(--hairline)] bg-[var(--band)] p-[3px] ${
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
            className={segmentClass(active, disabled)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedPill;
