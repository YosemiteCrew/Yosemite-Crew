'use client';
import React from 'react';
import clsx from 'clsx';
import { StatusOption } from '@/app/features/companions/pages/Companions/types';
import StatusPill, { type StatusPillTokens } from '@/app/ui/primitives/StatusPill/StatusPill';

type InvoiceStatusFilterPillsProps = {
  options: StatusOption[];
  activeStatus: string;
  setActiveStatus: (value: string) => void;
  /** Kept for caller compatibility; geometry now comes from the shared StatusPill primitive. */
  size?: 'sm' | 'md';
  className?: string;
};

const getStatusPillTokens = (option: StatusOption): StatusPillTokens => ({
  bg: option.bg ?? 'var(--color-pill-neutral-bg)',
  text: option.text ?? 'var(--color-pill-neutral-text)',
  border: option.border ?? option.bg ?? 'var(--color-pill-neutral-border)',
});

const getStatusPillStyle = (
  option: StatusOption,
  isActive: boolean
): React.CSSProperties | undefined => {
  if (!isActive) {
    return {
      backgroundColor: 'transparent',
      borderColor: 'var(--hairline)',
      color: 'var(--ink-muted)',
      fontWeight: 600,
    };
  }
  if (option.key.toLowerCase() === 'all') {
    return {
      backgroundColor: 'var(--inset)',
      borderColor: 'var(--divider)',
      color: 'var(--ink)',
      fontWeight: 700,
    };
  }
  return undefined;
};

/**
 * The finance list's status filter as the design's inline segmented pills
 * (All / Paid / Unpaid / Partial in the mock; the real backend taxonomy here),
 * replacing the shared Filters "All statuses" dropdown. The active pill sits on
 * --inset with a --divider ring and 700 --ink; the rest are hairline-outlined
 * 600 --ink-muted. Both the desktop header row and the phone list reuse this.
 */
const InvoiceStatusFilterPills = ({
  options,
  activeStatus,
  setActiveStatus,
  size = 'sm',
  className,
}: InvoiceStatusFilterPillsProps) => (
  <div /* NOSONAR: styled flex pill group; native <fieldset> defaults (block layout, border, required legend) break the pill design */
    className={clsx('flex items-center gap-2', className)}
    role="group"
    aria-label="Filter invoices by status"
  >
    {options.map((option) => {
      const isActive = option.key === activeStatus;
      return (
        <button
          key={option.key}
          type="button"
          onClick={() => setActiveStatus(option.key)}
          aria-pressed={isActive}
          className={clsx(
            'inline-flex shrink-0 items-center justify-center rounded-full! bg-transparent transition-opacity duration-200 hover:opacity-100',
            size === 'md' ? 'my-0.5 min-h-[38px] px-1 py-1' : 'p-0'
          )}
        >
          <StatusPill
            tokens={getStatusPillTokens(option)}
            label={option.name}
            style={getStatusPillStyle(option, isActive)}
          />
        </button>
      );
    })}
  </div>
);

export default InvoiceStatusFilterPills;
