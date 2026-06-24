import React from 'react';
import AppointmentAvatar from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentAvatar';

type StaffFieldProps = {
  /** Floating label, e.g. "Assigned Lead" / "Support Staff". */
  label: string;
  /** Assigned person's name; falls back to an em dash placeholder when empty. */
  name?: string;
  photoUrl?: string;
};

/**
 * Read display of an assigned staff member — a floating-label box showing the
 * name with a trailing initial-circle avatar, mirroring the client/patient name
 * field in the Add Appointment central modal (no dropdown).
 */
const StaffField = ({ label, name, photoUrl }: StaffFieldProps) => {
  const hasValue = Boolean(name?.trim());
  return (
    <div className="relative w-full">
      <div className="relative flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl border border-input-border-default bg-(--whitebg) py-2 pr-2 pl-5">
        <span
          className={`min-w-0 flex-1 truncate text-left text-body-4 ${hasValue ? 'text-text-primary' : 'text-input-text-placeholder'}`}
        >
          {hasValue ? name : 'Unassigned'}
        </span>
        {hasValue && <AppointmentAvatar name={name!} photoUrl={photoUrl} size={32} />}
      </div>
      <span className="pointer-events-none absolute -top-2 left-5 z-10 bg-(--whitebg) px-1 text-caption-2 text-text-secondary">
        {label}
      </span>
    </div>
  );
};

export default StaffField;
