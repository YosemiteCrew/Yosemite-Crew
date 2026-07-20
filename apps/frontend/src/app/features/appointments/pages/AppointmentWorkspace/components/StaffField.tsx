import React from 'react';
import AppointmentAvatar from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentAvatar';

type StaffFieldProps = {
  /** Field label shown above the box, e.g. "Assigned Lead" / "Support Staff". */
  label: string;
  /** Assigned person's name; falls back to an em dash placeholder when empty. */
  name?: string;
  photoUrl?: string;
};

/**
 * Read display of an assigned staff member — a static label above a box showing
 * the name with a trailing initial-circle avatar, mirroring the client/patient
 * name field in the Add Appointment central modal (no dropdown).
 */
const StaffField = ({ label, name, photoUrl }: StaffFieldProps) => {
  const hasValue = Boolean(name?.trim());
  return (
    <div className="w-full">
      <span className="mb-1.5 block truncate text-[12.5px] font-semibold text-[var(--ink-soft)]">
        {label}
      </span>
      <div className="flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl border border-input-border-default bg-(--whitebg) py-2 pr-2 pl-5">
        <span
          className={`min-w-0 flex-1 truncate text-left text-body-4 ${hasValue ? 'text-text-primary' : 'text-input-text-placeholder'}`}
        >
          {hasValue ? name : 'Unassigned'}
        </span>
        {hasValue && <AppointmentAvatar name={name!} photoUrl={photoUrl} size={32} />}
      </div>
    </div>
  );
};

export default StaffField;
