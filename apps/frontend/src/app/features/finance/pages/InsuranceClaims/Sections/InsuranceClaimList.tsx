'use client';
import React, { useMemo } from 'react';
import { IoEyeOutline } from 'react-icons/io5';
import { formatMoneyPrecise } from '@/app/lib/money';
import GenericTable, { type Column } from '@/app/ui/tables/GenericTable/GenericTable';
import InsuranceClaimStatusBadge from '@/app/features/finance/pages/InsuranceClaims/Sections/InsuranceClaimStatusBadge';
import type { InsuranceClaim } from '@/app/features/finance/types/insuranceClaim';

type InsuranceClaimListProps = {
  claims: InsuranceClaim[];
  /** The open claim, highlighted in the list. */
  activeClaimId: string | null;
  onSelect: (claim: InsuranceClaim) => void;
};

/** A nullable money column: a dash when the figure has not been set yet. */
const money = (amount: number | null, currency: string): string =>
  amount == null ? '-' : formatMoneyPrecise(amount, currency);

/**
 * The insurer's name over its policy number, the way the invoice table stacks a
 * primary and a quiet second line, so the two finance tables read as one family.
 */
const InsurerCell = ({ claim }: { claim: InsuranceClaim }) => (
  <div className="flex flex-col gap-0.5 min-w-0">
    <span className="truncate text-body-3 text-text-primary" title={claim.insurerName}>
      {claim.insurerName}
    </span>
    <span className="truncate text-caption-2 text-text-secondary" title={claim.policyNumber}>
      {claim.policyNumber}
    </span>
  </div>
);

/**
 * The insurance claims list, rendered through the shared `GenericTable` so it
 * inherits the app's column-header typography, contrast, sticky behaviour and
 * pager rather than maintaining a second finance table of its own.
 */
const InsuranceClaimList = ({ claims, activeClaimId, onSelect }: InsuranceClaimListProps) => {
  const columns = useMemo<Column<InsuranceClaim>[]>(
    () => [
      {
        key: 'insurerName',
        label: 'Insurer / policy',
        render: (claim) => <InsurerCell claim={claim} />,
      },
      {
        key: 'claimNumber',
        label: 'Claim no.',
        render: (claim) => (
          <span className="text-text-secondary tabular-nums">{claim.claimNumber ?? '-'}</span>
        ),
      },
      {
        key: 'submittedAmount',
        label: 'Submitted',
        render: (claim) => (
          <span className="block text-right tabular-nums text-text-primary">
            {formatMoneyPrecise(claim.submittedAmount, claim.currency)}
          </span>
        ),
      },
      {
        key: 'approvedAmount',
        label: 'Approved',
        render: (claim) => (
          <span className="block text-right tabular-nums text-text-secondary">
            {money(claim.approvedAmount, claim.currency)}
          </span>
        ),
      },
      {
        // Money reads down the column, so the settled figure is right-aligned and
        // weighted the way the invoice table's TOTAL is.
        key: 'paidAmount',
        label: 'Paid',
        render: (claim) => (
          <span className="block text-right font-bold tabular-nums text-text-primary">
            {money(claim.paidAmount, claim.currency)}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        render: (claim) => <InsuranceClaimStatusBadge status={claim.status} />,
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (claim) => (
          <button
            type="button"
            onClick={() => onSelect(claim)}
            className="grid-row-action flex size-[30px] items-center justify-center rounded-full! border cursor-pointer transition-colors hover:bg-card-hover"
            aria-label={`Open the claim for ${claim.insurerName}`}
          >
            <IoEyeOutline size={14} aria-hidden="true" />
          </button>
        ),
      },
    ],
    [onSelect]
  );

  return (
    <GenericTable
      data={claims}
      columns={columns}
      caption="Insurance claims for this organisation"
      itemNoun="claims"
      pagination
      // Kept through GenericTable's row hook rather than dropped: without it the
      // detail panel below can belong to any row on screen.
      rowClassName={(claim) => (claim.id === activeClaimId ? 'bg-card-hover' : '')}
    />
  );
};

export default InsuranceClaimList;
