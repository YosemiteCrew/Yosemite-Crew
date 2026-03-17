import React from 'react';

type BoardScopeToggleProps = {
  showMineOnly: boolean;
  disabled?: boolean;
  onChange: (nextShowMineOnly: boolean) => void;
  allLabel: string;
  mineLabel: string;
};

const BoardScopeToggle = ({
  showMineOnly,
  disabled,
  onChange,
  allLabel,
  mineLabel,
}: BoardScopeToggleProps) => {
  const isAll = !showMineOnly;
  const sliderClass = isAll
    ? 'translate-x-0 bg-[#247AED] border-[#247AED]'
    : 'translate-x-full bg-[#D28F9A] border-[#D28F9A]';
  const allTextClass = isAll ? 'text-neutral-0' : 'text-text-secondary';
  const mineTextClass = isAll ? 'text-text-secondary' : 'text-neutral-0';

  return (
    <div
      className={`relative inline-flex items-center h-9 w-[320px] max-w-full rounded-[999px]! border border-card-border bg-white overflow-hidden ${
        disabled ? 'opacity-70' : ''
      }`}
    >
      <div
        aria-hidden
        className={`absolute top-0 bottom-0 left-0 w-1/2 rounded-[999px]! border-0 transition-all duration-300 ease-in-out ${sliderClass}`}
      />
      <button
        type="button"
        onClick={() => onChange(false)}
        disabled={disabled}
        className={`relative z-10 w-1/2 h-full text-body-4 transition-colors duration-200 ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        } ${allTextClass}`}
      >
        {allLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        disabled={disabled}
        className={`relative z-10 w-1/2 h-full text-body-4 transition-colors duration-200 ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        } ${mineTextClass}`}
      >
        {mineLabel}
      </button>
    </div>
  );
};

export default BoardScopeToggle;
