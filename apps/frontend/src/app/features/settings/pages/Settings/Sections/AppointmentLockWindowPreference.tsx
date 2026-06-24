'use client';
import React, { useState } from 'react';
import { Primary } from '@/app/ui/primitives/Buttons';
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

const HOURS_TO_MINUTES = 60;

const HoursField = ({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="flex flex-col gap-1">
    <span id={`${id}-label`} className="text-caption-2 font-bold text-text-tertiary">
      {label}
    </span>
    <span className="flex items-stretch overflow-hidden rounded-2xl border border-input-border-default focus-within:border-input-border-active">
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={MIN_LOCK_HOURS}
        max={MAX_LOCK_HOURS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-body-4 text-text-primary outline-none"
      />
      <span className="flex items-center bg-neutral-100 px-3 text-body-4 text-neutral-700">
        hours
      </span>
    </span>
  </div>
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

  const handleSave = () => {
    const next = {
      outpatientHours: clampLockHours(Number(outpatient)),
      inpatientHours: clampLockHours(Number(inpatient)),
    };
    const didSave = setSavedLockWindow(next);
    // Reflect the clamped values back into the inputs.
    setOutpatient(String(next.outpatientHours));
    setInpatient(String(next.inpatientHours));

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

    if (didSave) {
      notify('success', {
        title: 'Lock window updated',
        text: 'Appointments will lock to read-only after the configured window.',
      });
      return;
    }
    notify('error', {
      title: 'Unable to update lock window',
      text: 'Please try again.',
    });
  };

  return (
    <div className="border border-card-border rounded-2xl">
      <div className="px-6! py-3! border-b border-b-card-border flex items-center justify-between">
        <div className="text-body-3 text-text-primary">Appointment lock window</div>
      </div>
      <div className="flex flex-col gap-3 px-6! py-6!">
        <p className="text-body-4 text-text-secondary">
          How long after an appointment starts it stays editable before locking to read-only.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          <HoursField
            id="lock-window-outpatient"
            label="Outpatient"
            value={outpatient}
            onChange={setOutpatient}
          />
          <HoursField
            id="lock-window-inpatient"
            label="Inpatient"
            value={inpatient}
            onChange={setInpatient}
          />
        </div>
        <div className="w-full flex justify-end!">
          <Primary href="#" text="Save lock window" onClick={handleSave} />
        </div>
      </div>
    </div>
  );
};

export default AppointmentLockWindowPreference;
