'use client';
import React from 'react';
import clsx from 'clsx';

export type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Names the control for assistive technology. Required: a bare switch says nothing. */
  label: string;
  disabled?: boolean;
  /** Extra classes for the track, e.g. positioning within a row. */
  className?: string;
  id?: string;
};

/**
 * The product's one switch.
 *
 * Eight hand-rolled copies of this control shipped at six different sizes: a
 * 56x32 track with a 24px knob in the Add-inventory drawer, 48x24 in the Rooms
 * table, 44x24 in booking setup, 40x24 in Settings, 36x22 in the chat info
 * panel, and a 44x26 CSS one in developer settings. Toggling "Visible in
 * Inventory" and then "Cross-clinic messaging" meant operating what looked like
 * two different widgets.
 *
 * The geometry here is the design system's `.switch`: a 40x24 track, an 18px
 * knob inset 3px, so the travel is 19px. Two of the eight copies already
 * matched it; the rest were the drift.
 *
 * A real `button` with `role="switch"` and `aria-checked`, so the state is
 * announced rather than only filled in blue.
 */
const Switch = ({ checked, onChange, label, disabled = false, className, id }: SwitchProps) => (
  <button
    type="button"
    id={id}
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={clsx(
      'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--screen)]',
      'disabled:cursor-not-allowed disabled:opacity-50',
      checked ? 'bg-[var(--blue)]' : 'bg-[var(--divider)]',
      className
    )}
  >
    <span
      aria-hidden="true"
      className={clsx(
        'inline-block size-[18px] transform rounded-full bg-white transition-transform',
        checked ? 'translate-x-[19px]' : 'translate-x-[3px]'
      )}
    />
  </button>
);

export default Switch;
