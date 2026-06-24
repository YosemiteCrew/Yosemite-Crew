import React from 'react';
import { IoClose } from 'react-icons/io5';
import type { AlertSeverity } from '@/app/features/appointments/types/workspace';

type AlertPillProps = {
  id?: string;
  label: string;
  severity: AlertSeverity;
  onRemove?: (id: string) => void;
};

const SEVERITY_STYLE: Record<AlertSeverity, { background: string; color: string; border: string }> =
  {
    low: {
      background: 'var(--color-neutral-100)',
      color: 'var(--color-neutral-700)',
      border: 'var(--color-neutral-300)',
    },
    medium: {
      background: 'var(--color-warning-100)',
      color: 'var(--color-warning-700)',
      border: 'var(--color-warning-300)',
    },
    high: {
      background: 'var(--color-danger-100)',
      color: 'var(--color-danger-700)',
      border: 'var(--color-danger-300)',
    },
    critical: {
      background: 'var(--color-neutral-900)',
      color: 'var(--color-neutral-0)',
      border: 'var(--color-neutral-900)',
    },
  };

/** Companion alert pill styled from the persisted alert severity. */
const AlertPill = ({ id, label, severity, onRemove }: AlertPillProps) => {
  const style = SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.medium;
  return (
    <span
      className="flex min-h-5 items-center justify-center gap-1.5 rounded-2xl border px-2 text-[12px] font-medium leading-[120%]"
      style={{
        backgroundColor: style.background,
        borderColor: style.border,
        color: style.color,
      }}
    >
      {label}
      {id && onRemove ? (
        <button
          type="button"
          aria-label={`Remove alert ${label}`}
          onClick={() => onRemove(id)}
          className="flex size-3.5 items-center justify-center rounded-full transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
          style={{ color: style.color }}
        >
          <IoClose size={11} aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
};

export default AlertPill;
