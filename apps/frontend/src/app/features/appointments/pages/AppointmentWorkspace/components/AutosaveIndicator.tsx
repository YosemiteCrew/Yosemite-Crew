'use client';
import React from 'react';
import { IoCheckmarkCircle, IoCloudOfflineOutline, IoSyncOutline } from 'react-icons/io5';
import type { WorkspaceSaveStatus } from '@/app/features/appointments/types/workspace';
import { formatStampTime } from '@/app/lib/appointmentWorkspace';

type AutosaveIndicatorProps = {
  status: WorkspaceSaveStatus;
  /** ISO timestamp of the last successful save, shown as "Autosaved HH:MM". */
  savedAt?: string;
  className?: string;
};

/**
 * Text-only autosave state, shown to the right of a section title (per the design's
 * micro-states). It is driven off the existing explicit-save lifecycle — there is no
 * separate autosave engine — so it degrades to nothing (`idle`) until the clinician
 * saves. `saving` while a save is in flight, `saved` once it lands, `offline` when a
 * save fails on a network error (edits stay locally). No toasts for routine saves.
 */
const AutosaveIndicator = ({ status, savedAt, className = '' }: AutosaveIndicatorProps) => {
  if (status === 'idle') return null;

  const base = `inline-flex items-center gap-1.5 text-caption-1 font-semibold ${className}`;

  if (status === 'saving') {
    return (
      <span
        data-testid="autosave-indicator"
        data-state="saving"
        className={`${base} text-text-tertiary`}
      >
        <IoSyncOutline size={13} aria-hidden="true" className="animate-spin" />
        Saving…
      </span>
    );
  }

  if (status === 'offline') {
    return (
      <span
        data-testid="autosave-indicator"
        data-state="offline"
        role="status"
        className={`${base} text-danger-700`}
      >
        <IoCloudOfflineOutline size={13} aria-hidden="true" />
        Offline · retrying, edits kept locally
      </span>
    );
  }

  const savedTime = formatStampTime(savedAt);
  return (
    <span
      data-testid="autosave-indicator"
      data-state="saved"
      role="status"
      className={`${base} text-text-secondary`}
    >
      <IoCheckmarkCircle size={13} aria-hidden="true" className="text-pill-success-text" />
      {savedTime ? `Autosaved ${savedTime}` : 'Autosaved'}
    </span>
  );
};

export default AutosaveIndicator;
