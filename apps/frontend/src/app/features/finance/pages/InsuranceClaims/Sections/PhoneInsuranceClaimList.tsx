'use client';
import React from 'react';

import { formatMoneyPrecise } from '@/app/lib/money';
import InsuranceClaimStatusBadge from '@/app/features/finance/pages/InsuranceClaims/Sections/InsuranceClaimStatusBadge';
import type { InsuranceClaim } from '@/app/features/finance/types/insuranceClaim';

type PhoneInsuranceClaimListProps = {
  claims: InsuranceClaim[];
  /** The open claim, marked in the list the way the table marks its row. */
  activeClaimId: string | null;
  onSelect: (claim: InsuranceClaim) => void;
};

const CARD_SHADOW = 'shadow-[0_1px_2px_var(--sh03),0_6px_16px_var(--sh05)]';

/**
 * The settled figure a claim is judged on, and its label.
 *
 * The table gives Submitted, Approved and Paid three columns of equal weight.
 * A card cannot, and equal weight is not what an operator wants anyway: what
 * matters is how far the claim has got. Paid wins if present, then approved,
 * then the submitted ask - and the label says which, so a number is never
 * ambiguous about what it represents.
 */
const settledFigure = (claim: InsuranceClaim): { label: string; value: string } => {
  /* No dash branch, unlike the table's money cell. The table renders Approved
     and Paid as their own columns and each can be null; here every path has
     already established the figure it formats, so a nullable helper would be a
     branch nothing can reach. */
  const format = (amount: number) => formatMoneyPrecise(amount, claim.currency);
  if (claim.paidAmount != null) return { label: 'Paid', value: format(claim.paidAmount) };
  if (claim.approvedAmount != null)
    return { label: 'Approved', value: format(claim.approvedAmount) };
  return { label: 'Submitted', value: format(claim.submittedAmount) };
};

type PhoneInsuranceClaimCardProps = {
  claim: InsuranceClaim;
  isActive: boolean;
  onSelect: (claim: InsuranceClaim) => void;
};

const PhoneInsuranceClaimCard = ({ claim, isActive, onSelect }: PhoneInsuranceClaimCardProps) => {
  const figure = settledFigure(claim);

  return (
    <button
      type="button"
      onClick={() => onSelect(claim)}
      /* The same accessible name the table's eye button carries, so the label is
         one string across both breakpoints rather than two that drift. */
      aria-label={`Open the claim for ${claim.insurerName}`}
      className={`w-full text-left flex flex-col gap-[7px] rounded-2xl bg-[var(--screen)] px-3.5 py-3 border ${
        isActive ? 'border-[var(--blue)] bg-card-hover' : 'border-[var(--hairline)]'
      } ${CARD_SHADOW}`}
    >
      <span className="flex items-start justify-between gap-2">
        {/* Wraps rather than clipping. The table truncates both of these and
            offers the full value through `title`, which needs a hover this
            surface does not have; a card can grow downwards instead. */}
        <span className="min-w-0 break-words text-[13.5px] font-bold text-[var(--ink)]">
          {claim.insurerName}
        </span>
        {/* Status leads the card because it is the column the table pushed
            furthest off-screen, and the one a claims list is opened to read. */}
        <InsuranceClaimStatusBadge status={claim.status} />
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="min-w-0 break-words text-[11.5px] text-[var(--ink-faint)]">
          {claim.claimNumber ? `${claim.policyNumber} · ${claim.claimNumber}` : claim.policyNumber}
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[10px] text-[var(--ink-faint)]">{figure.label}</span>
          <span className="block text-[14px] font-bold tabular-nums text-[var(--ink)]">
            {figure.value}
          </span>
        </span>
      </span>
    </button>
  );
};

/**
 * The phone (< 768px) form of the insurance claims list.
 *
 * `InsuranceClaims` had no phone branch, so a phone rendered
 * `InsuranceClaimList`'s seven-column table inside a 364px rail with `Approved`,
 * `Paid`, `Status` and `Actions` past the right edge - `Status` starting 103px
 * out. The rail scrolls, so the page never moved sideways; the problem was that
 * the decisive column was behind an undiscoverable swipe.
 *
 * Mirrors `PhoneEstimateList` and `PhoneInvoiceList` so the finance lists read
 * as one product at this width.
 */
const PhoneInsuranceClaimList = ({
  claims,
  activeClaimId,
  onSelect,
}: PhoneInsuranceClaimListProps) => (
  <div className="flex flex-col gap-2.5 pb-1">
    {claims.map((claim) => (
      <PhoneInsuranceClaimCard
        key={claim.id}
        claim={claim}
        isActive={claim.id === activeClaimId}
        onSelect={onSelect}
      />
    ))}
  </div>
);

export default PhoneInsuranceClaimList;
