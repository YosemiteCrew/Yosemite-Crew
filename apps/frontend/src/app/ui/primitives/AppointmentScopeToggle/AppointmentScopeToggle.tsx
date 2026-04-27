import React from 'react';

type AppointmentScopeToggleProps = {
  showMineOnly: boolean;
  disabled?: boolean;
  onChange: (nextShowMineOnly: boolean) => void;
};

const AppointmentScopeToggle = ({
  showMineOnly,
  disabled = false,
  onChange,
}: AppointmentScopeToggleProps) => {
  const sliderClass = showMineOnly
    ? 'translate-x-5 bg-success-700'
    : 'translate-x-0 bg-text-tertiary';

  return (
    <button
      type="button"
      aria-pressed={showMineOnly}
      aria-label={showMineOnly ? 'Show all appointments' : 'Show my appointments'}
      disabled={disabled}
      onClick={() => onChange(!showMineOnly)}
      className={`inline-flex h-12 w-24 shrink-0 items-center justify-center gap-2 px-1 text-body-4 text-text-primary transition-colors hover:text-text-primary ${
        disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
      }`}
    >
      <span
        aria-hidden="true"
        className="relative h-6 w-11 shrink-0 rounded-full bg-neutral-200 p-0.5"
      >
        <span
          className={`block h-5 w-5 rounded-full transition-transform duration-200 ${sliderClass}`}
        />
      </span>
      <span className="min-w-7 text-left">Mine</span>
    </button>
  );
};

export default AppointmentScopeToggle;
