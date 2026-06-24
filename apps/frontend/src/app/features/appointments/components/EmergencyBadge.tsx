import React from 'react';
import { IoWarning } from 'react-icons/io5';

const EMERGENCY_BADGE_STYLE: React.CSSProperties = {
  border: '1px solid var(--error-color)',
  background: 'var(--color-danger-100)',
  color: 'var(--error-color)',
  fontFamily: 'var(--font-satoshi)',
  fontSize: '12px',
  fontWeight: 500,
  lineHeight: '150%',
  letterSpacing: '-0.22px',
};

type EmergencyBadgeProps = {
  className?: string;
};

/** Shared "Emergency" badge — red outline + warning icon, used across appointments. */
const EmergencyBadge = ({ className }: EmergencyBadgeProps) => (
  <div
    className={`flex h-5.5 items-center gap-1 rounded-lg px-2 whitespace-nowrap ${className ?? ''}`}
    style={EMERGENCY_BADGE_STYLE}
  >
    <IoWarning size={11} aria-hidden="true" />
    Emergency
  </div>
);

export default EmergencyBadge;
