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
 * Shared meta-bar field chrome: a 46px box with a filled surface, a 1.5px
 * hairline border, and the label notched into the top border.
 *
 * The notch is a real `fieldset`/`legend`, which cuts the border where the text
 * sits. The previous version painted `--screen` behind the label to fake the
 * gap, which only lined up when the field happened to sit directly on the page:
 * inside the workspace meta bar the field sits on a card, so the patch showed as
 * a lighter box floating on the label. A legend needs no background at all and
 * is therefore correct on every surface, in both themes.
 */
export const MetaFieldShell = ({ label, children, className = '' }: MetaFieldShellProps) => (
  <fieldset
    // min-w-0 keeps the browser's default `min-inline-size: min-content` on
    // fieldset from forcing the box wider than its grid column.
    className={`relative m-0 flex h-[46px] w-full min-w-0 items-center gap-2 rounded-[14px] border-[1.5px] pt-0 pr-2 pb-0 pl-3.5 ${className}`}
    style={{ background: 'var(--field-bg)', borderColor: 'var(--hairline)' }}
  >
    <legend
      className="ml-0 truncate p-0 px-[5px] text-[10.5px] font-semibold leading-[120%]"
      style={{ color: 'var(--ink-faint)' }}
    >
      {label}
    </legend>
    {children}
  </fieldset>
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
