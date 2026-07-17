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
const segmentClass = (active: boolean, disabled?: boolean) =>
  `relative z-10 h-full w-1/2 rounded-[999px]! text-[12.5px] transition-colors ${
    disabled ? 'cursor-not-allowed' : 'cursor-pointer'
  } ${
    active
      ? 'bg-[var(--screen)] font-bold text-[var(--ink)] shadow-[0_1px_3px_var(--sh08)]'
      : 'font-semibold text-text-secondary hover:text-text-primary'
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
      className={`inline-flex items-center h-10 w-[320px] max-w-full rounded-[999px]! border border-[var(--hairline)] bg-[var(--band)] p-[3px] ${
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
