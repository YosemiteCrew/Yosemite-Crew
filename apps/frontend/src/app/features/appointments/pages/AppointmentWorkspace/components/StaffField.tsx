import React from 'react';
import AppointmentAvatar from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentAvatar';

type StaffFieldProps = {
  /** Field label notched into the box's top border, e.g. "Assigned lead". */
  label: string;
  /** Assigned person's name; falls back to an em dash placeholder when empty. */
  name?: string;
  photoUrl?: string;
};

type MetaFieldShellProps = {
  label: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Shared meta-bar field chrome: a 46px box with a 1.5px hairline border and the
 * label notched into the top border (the label paints the screen background
 * behind itself so the border reads as interrupted rather than overlapped).
 */
export const MetaFieldShell = ({ label, children, className = '' }: MetaFieldShellProps) => (
  <div
    className={`relative flex h-[46px] w-full items-center gap-2 rounded-[14px] border-[1.5px] pr-2 pl-3.5 ${className}`}
    style={{ borderColor: 'var(--hairline)' }}
  >
    <span
      className="absolute -top-[7px] left-3 truncate px-[5px] text-[10.5px] font-semibold leading-[120%]"
      style={{ background: 'var(--screen)', color: 'var(--ink-faint)' }}
    >
      {label}
    </span>
    {children}
  </div>
);

/** Value text shared by every meta-bar field — 13.5px/600 on the body ink. */
export const MetaFieldValue = ({
  children,
  isPlaceholder = false,
}: {
  children: React.ReactNode;
  isPlaceholder?: boolean;
}) => (
  <span
    className="min-w-0 flex-1 truncate text-left text-[13.5px] font-semibold leading-[120%]"
    style={{ color: isPlaceholder ? 'var(--ink-faint)' : 'var(--ink-body)' }}
  >
    {children}
  </span>
);

/**
 * Read display of an assigned staff member — a notched-label box showing the
 * name with a trailing initial-circle avatar (no dropdown; the assignment is
 * changed elsewhere).
 */
const StaffField = ({ label, name, photoUrl }: StaffFieldProps) => {
  const hasValue = Boolean(name?.trim());
  return (
    <MetaFieldShell label={label}>
      <MetaFieldValue isPlaceholder={!hasValue}>{hasValue ? name : 'Unassigned'}</MetaFieldValue>
      {hasValue && <AppointmentAvatar name={name!} photoUrl={photoUrl} size={30} />}
    </MetaFieldShell>
  );
};

export default StaffField;
