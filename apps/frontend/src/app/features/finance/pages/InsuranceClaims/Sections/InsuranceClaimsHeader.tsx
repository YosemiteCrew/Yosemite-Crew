'use client';
import React, { useMemo } from 'react';
import { IoInformationCircleOutline } from 'react-icons/io5';
import { formatMoneyPrecise, sharedCurrency } from '@/app/lib/money';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import InvoiceStatusFilterPills from '@/app/features/finance/pages/Finance/Sections/InvoiceStatusFilterPills';
import {
  InsuranceClaimStatusFilters,
  type InsuranceClaim,
} from '@/app/features/finance/types/insuranceClaim';
import type { CompanionChoice } from '@/app/features/finance/pages/InsuranceClaims/Sections/CreateInsuranceClaimDialog';

type InsuranceClaimsHeaderProps = {
  claims: InsuranceClaim[];
  currency: string;
  activeStatus: string;
  onStatusChange: (status: string) => void;
  companions: CompanionChoice[];
  onCreate: () => void;
};

/**
 * The two figures a practice asks of a claims list: what is still with the
 * insurer, and what has been paid back. DRAFT/SUBMITTED/UNDER_REVIEW count as in
 * progress; only a PAID claim's `paidAmount` counts as recovered.
 */
const summariseClaims = (claims: InsuranceClaim[]) =>
  claims.reduce(
    (totals, claim) => {
      if (
        claim.status === 'DRAFT' ||
        claim.status === 'SUBMITTED' ||
        claim.status === 'UNDER_REVIEW'
      ) {
        return { ...totals, inProgress: totals.inProgress + claim.submittedAmount };
      }
      if (claim.status === 'PAID' && claim.paidAmount != null) {
        return { ...totals, paid: totals.paid + claim.paidAmount };
      }
      return totals;
    },
    { inProgress: 0, paid: 0 }
  );

/**
 * The Insurance claims header: the same anatomy as Finance and Estimates - a
 * title with a live count, an info affordance, a metrics sub-line, then the
 * status filter and page actions on the right of that row.
 */
const InsuranceClaimsHeader = ({
  claims,
  currency,
  activeStatus,
  onStatusChange,
  companions,
  onCreate,
}: InsuranceClaimsHeaderProps) => {
  const metricsCurrency = useMemo(() => sharedCurrency(claims, currency), [claims, currency]);
  const metrics = useMemo(() => summariseClaims(claims), [claims]);

  return (
    <div className="flex items-center justify-between w-full flex-wrap gap-2">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <h1 className="text-page-title">
            {'Insurance claims'}{' '}
            <span className="text-page-title-count">{`(${claims.length})`}</span>
          </h1>
          <GlassTooltip
            content="File a claim against a pet's insurer, submit it, then record the insurer's decision and payment as the claim is settled."
            side="bottom"
          >
            <button
              type="button"
              aria-label="Insurance claims info"
              className="inline-flex size-5 shrink-0 items-center justify-center leading-none translate-y-px text-text-secondary hover:text-text-primary transition-colors"
            >
              <IoInformationCircleOutline size={17} />
            </button>
          </GlassTooltip>
        </div>
        <p className="text-[13.5px] text-text-secondary">
          {`${formatMoneyPrecise(metrics.inProgress, metricsCurrency)} with insurers · ${formatMoneyPrecise(
            metrics.paid,
            metricsCurrency
          )} paid back`}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <InvoiceStatusFilterPills
          options={InsuranceClaimStatusFilters}
          activeStatus={activeStatus}
          setActiveStatus={onStatusChange}
          ariaLabel="Filter claims by status"
          className="flex-wrap justify-end"
        />
        <Secondary href="/finance" text="Invoices" ariaLabel="Back to invoices" />
        <PermissionGate allOf={[PERMISSIONS.BILLING_EDIT_ANY]}>
          <Primary
            text="New insurance claim"
            isDisabled={companions.length === 0}
            onClick={onCreate}
            ariaLabel="Create a new insurance claim"
          />
        </PermissionGate>
      </div>
    </div>
  );
};

export default InsuranceClaimsHeader;
