'use client';
import React, { useState } from 'react';
import { useNotify } from '@/app/hooks/useNotify';
import {
  MAX_LOCK_HOURS,
  MIN_LOCK_HOURS,
  clampLockHours,
  setSavedLockWindow,
} from '@/app/lib/appointmentLockWindow';
import { useAppointmentLockWindow } from '@/app/hooks/useAppointmentLockWindow';
import { useOrgStore } from '@/app/stores/orgStore';
import { updateOrg } from '@/app/features/organization/services/orgService';
import { PreferenceRow } from './PreferenceGroup';
import '@/app/features/settings/styles/Settings.css';

const HOURS_TO_MINUTES = 60;

/**
 * The design's compact hours stepper: a 34px `--field-bg` pill with a 1.5px hairline
 * border, a 13px/700 tabular value and an inset "hours" suffix behind a hairline rule.
 * The uppercase micro-label sits above it.
 */
const HoursField = ({
  id,
  label,
  value,
  onChange,
  onCommit,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}) => (
  <span className="flex flex-col gap-1">
    <label htmlFor={id} className="yc-settings-hours-label">
      {label}
    </label>
    <span className="yc-settings-hours-field">
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={MIN_LOCK_HOURS}
        max={MAX_LOCK_HOURS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="yc-settings-hours-input"
      />
      <span className="yc-settings-hours-suffix">hours</span>
    </span>
  </span>
);

/**
 * Org appointment lock/edit window — how long after an appointment's start time
 * its clinical workspace stays editable before it locks to read-only. Consumed
 * by `isPastLockWindow` in the appointment workspace.
 */
const AppointmentLockWindowPreference = () => {
  const { notify } = useNotify();
  const saved = useAppointmentLockWindow();
  const primaryOrg = useOrgStore((s) => s.getPrimaryOrg());

  // When the backend returns the lock-window extensions (post-merge), mirror them
  // into local storage once so the rest of the app (which reads the local window)
  // stays in sync. No-op while the fork backend omits these fields.
  const orgOutMinutes = primaryOrg?.appointmentLockWindowOutpatientMinutes;
  const orgInMinutes = primaryOrg?.appointmentLockWindowInpatientMinutes;
  const [prevOrgMinutes, setPrevOrgMinutes] = useState<string | null>(null);
  if (typeof orgOutMinutes === 'number' && typeof orgInMinutes === 'number') {
    const orgKey = `${orgOutMinutes}:${orgInMinutes}`;
    if (orgKey !== prevOrgMinutes) {
      setPrevOrgMinutes(orgKey);
      setSavedLockWindow({
        outpatientHours: clampLockHours(orgOutMinutes / HOURS_TO_MINUTES),
        inpatientHours: clampLockHours(orgInMinutes / HOURS_TO_MINUTES),
      });
    }
  }

  const [outpatient, setOutpatient] = useState(String(saved.outpatientHours));
  const [inpatient, setInpatient] = useState(String(saved.inpatientHours));

  // Re-sync local inputs when the persisted preference changes elsewhere.
  const [prevSaved, setPrevSaved] = useState(saved);
  if (prevSaved !== saved) {
    setPrevSaved(saved);
    setOutpatient(String(saved.outpatientHours));
    setInpatient(String(saved.inpatientHours));
  }

  // Auto-save model from the design: the fields commit as soon as they are left
  // (blur or Enter) and the page header carries the single "Changes save
  // automatically" indicator, so there is no per-preference Save button. Only
  // failures surface a notification.
  const commit = () => {
    const next = {
      outpatientHours: clampLockHours(Number(outpatient)),
      inpatientHours: clampLockHours(Number(inpatient)),
    };
    // Reflect the clamped values back into the inputs.
    setOutpatient(String(next.outpatientHours));
    setInpatient(String(next.inpatientHours));

    if (
      next.outpatientHours === saved.outpatientHours &&
      next.inpatientHours === saved.inpatientHours
    ) {
      return;
    }

    const didSave = setSavedLockWindow(next);

    // Also persist to the org via the FHIR extension API (minutes). The deployed
    // fork backend does not yet handle these extensions, so this is best-effort:
    // it keeps the preference server-ready for the upcoming backend merge without
    // blocking the local save above. Failures are intentionally swallowed.
    if (primaryOrg?._id) {
      void updateOrg({
        ...primaryOrg,
        appointmentLockWindowOutpatientMinutes: next.outpatientHours * HOURS_TO_MINUTES,
        appointmentLockWindowInpatientMinutes: next.inpatientHours * HOURS_TO_MINUTES,
      }).catch(() => {
        // Backend support pending; local persistence already succeeded.
      });
    }

    if (!didSave) {
      notify('error', {
        title: 'Unable to update lock window',
        text: 'Please try again.',
      });
    }
  };

  return (
    <PreferenceRow
      label="Appointment lock window"
      description="How long after an appointment starts it stays editable before locking to read-only."
    >
      <span className="flex flex-wrap justify-end gap-2">
        <HoursField
          id="lock-window-outpatient"
          label="Outpatient"
          value={outpatient}
          onChange={setOutpatient}
          onCommit={commit}
        />
        <HoursField
          id="lock-window-inpatient"
          label="Inpatient"
          value={inpatient}
          onChange={setInpatient}
          onCommit={commit}
        />
      </span>
    </PreferenceRow>
  );
};

export default AppointmentLockWindowPreference;
