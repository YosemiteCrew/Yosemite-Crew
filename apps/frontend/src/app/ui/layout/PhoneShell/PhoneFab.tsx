'use client';

import React from 'react';
import { IoAdd } from 'react-icons/io5';

import type { FabAction } from './phoneShellConfig';

export type PhoneFabProps = {
  /** The current page's single primary creation action, or null for none. */
  action: FabAction | null;
  onAction: (action: FabAction) => void;
};

/**
 * The 52px ink floating action button, docked above the tab bar. It carries the
 * current page's single primary creation action (new appointment/task/companion/
 * product). Pages without a creation action pass `action = null` and no FAB is
 * rendered.
 */
const PhoneFab = ({ action, onAction }: PhoneFabProps) => {
  if (!action) return null;

  return (
    <button
      type="button"
      className="yc-phone-fab"
      aria-label={action.ariaLabel}
      onClick={() => onAction(action)}
    >
      <IoAdd size={24} aria-hidden />
    </button>
  );
};

export default PhoneFab;
