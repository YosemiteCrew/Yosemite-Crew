import React from 'react';

type BoardScopeToggleProps = {
  showMineOnly: boolean;
  disabled?: boolean;
  onChange: (nextShowMineOnly: boolean) => void;
  allLabel: string;
  mineLabel: string;
};

// Neutral raised-pill segmented control per the design recipe:
// track = --band + hairline, active segment = --screen raised (shadow), ink text.
// Board-density segment: 7px vertical padding, 12px text (measured from the design);
// content-sized horizontally (16px) since this toggle sits inline in toolbars.
const segmentClass = (active: boolean, disabled?: boolean) =>
  `rounded-full! px-4 py-[7px] text-[12px] transition-colors ${
    disabled ? 'cursor-not-allowed' : 'cursor-pointer'
  } ${
    active
      ? 'bg-[var(--screen)] font-bold text-[var(--ink)] shadow-[0_1px_3px_var(--sh08)]'
      : 'font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]'
  }`;

const BoardScopeToggle = ({
  showMineOnly,
  disabled,
  onChange,
  allLabel,
  mineLabel,
}: BoardScopeToggleProps) => {
  const isAll = !showMineOnly;

  return (
    <div
      className={`inline-flex items-center max-w-full rounded-full! border border-[var(--hairline)] bg-[var(--band)] p-[3px] ${
        disabled ? 'opacity-70' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => onChange(false)}
        disabled={disabled}
        aria-pressed={isAll}
        className={segmentClass(isAll, disabled)}
      >
        {allLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        disabled={disabled}
        aria-pressed={!isAll}
        className={segmentClass(!isAll, disabled)}
      >
        {mineLabel}
      </button>
    </div>
  );
};

export default BoardScopeToggle;
