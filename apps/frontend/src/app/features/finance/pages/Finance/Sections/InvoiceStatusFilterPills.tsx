'use client';
import React from 'react';
import clsx from 'clsx';
import { StatusOption } from '@/app/features/companions/pages/Companions/types';
import FilterChip from '@/app/ui/filters/FilterChip';

type InvoiceStatusFilterPillsProps = {
  options: StatusOption[];
  activeStatus: string;
  setActiveStatus: (value: string) => void;
  className?: string;
  /** Overridden by the estimates list, which filters estimates rather than invoices. */
  ariaLabel?: string;
};

/**
 * The finance list's status filter as the design's filter-chip row: sentence
 * case, hairline outline at rest, the active chip solid ink. It used to reuse
 * the ALL-CAPS StatusPill, so the toolbar read as a row of invoice statuses
 * rather than a set of filters. Both the desktop header row and the phone list
 * reuse this.
 */
const InvoiceStatusFilterPills = ({
  options,
  activeStatus,
  setActiveStatus,
  className,
  ariaLabel = 'Filter invoices by status',
}: InvoiceStatusFilterPillsProps) => (
  <div /* NOSONAR: styled flex pill group; native <fieldset> defaults (block layout, border, required legend) break the pill design */
    className={clsx('flex flex-wrap items-center gap-2', className)}
    role="group"
    aria-label={ariaLabel}
  >
    {options.map((option) => (
      <FilterChip
        key={option.key}
        label={option.name}
        active={option.key === activeStatus}
        onClick={() => setActiveStatus(option.key)}
      />
    ))}
  </div>
);

export default InvoiceStatusFilterPills;
