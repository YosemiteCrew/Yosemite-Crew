'use client';
import React from 'react';
import clsx from 'clsx';
import { StatusOption } from '@/app/features/companions/pages/Companions/types';

type InvoiceStatusFilterPillsProps = {
  options: StatusOption[];
  activeStatus: string;
  setActiveStatus: (value: string) => void;
  /** `sm` = desktop/tablet header pills (6/13 padding); `md` = phone pills (8/14 padding). */
  size?: 'sm' | 'md';
  className?: string;
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
            'shrink-0 rounded-full! border transition-colors duration-200',
            size === 'md' ? 'px-3.5 py-2 text-[12px]' : 'px-[13px] py-1.5 text-[12px]',
            isActive
              ? 'bg-[var(--inset)] border-[var(--divider)] font-bold text-[var(--ink)]'
              : 'border-[var(--hairline)] font-semibold text-[var(--ink-muted)] hover:bg-[var(--inset)]'
          )}
        >
          {option.name}
        </button>
      );
    })}
  </div>
);

export default InvoiceStatusFilterPills;
