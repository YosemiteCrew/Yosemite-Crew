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
  // Design toggle-switch recipe: 40x24 track (2.5px inset), 19px knob with a soft drop shadow.
  // On = --blue track + white knob; off = --divider track + --screen knob.
  // Label follows ink-body (on) / ink-muted (off).
  const trackClass = showMineOnly ? 'bg-[var(--blue)]' : 'bg-[var(--divider)]';
  const knobClass = showMineOnly ? 'translate-x-4 bg-white' : 'translate-x-0 bg-[var(--screen)]';

  return (
    <button
      type="button"
      aria-pressed={showMineOnly}
      aria-label={showMineOnly ? 'Show all appointments' : 'Show my appointments'}
      disabled={disabled}
      onClick={() => onChange(!showMineOnly)}
      className={`inline-flex shrink-0 items-center gap-2 transition-colors ${
        disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
      }`}
    >
      <span
        aria-hidden="true"
        className={`relative block h-6 w-10 shrink-0 rounded-full p-[2.5px] transition-colors ${trackClass}`}
      >
        <span
          className={`block size-[19px] rounded-full shadow-[0_1px_3px_var(--sh22)] transition-transform duration-200 ${knobClass}`}
        />
      </span>
      <span
        className={`text-[13px] font-medium ${
          showMineOnly ? 'text-[var(--ink-body)]' : 'text-[var(--ink-muted)]'
        }`}
      >
        Mine
      </span>
    </button>
  );
};

export default AppointmentScopeToggle;
