'use client';
import React, { useMemo } from 'react';
import { IoInformationCircleOutline } from 'react-icons/io5';
import { formatMoneyPrecise, sharedCurrency } from '@/app/lib/money';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import InvoiceStatusFilterPills from '@/app/features/finance/pages/Finance/Sections/InvoiceStatusFilterPills';
import InsuranceClaimList from '@/app/features/finance/pages/InsuranceClaims/Sections/InsuranceClaimList';
import InsuranceClaimDetail, {
  type ClaimAction,
} from '@/app/features/finance/pages/InsuranceClaims/Sections/InsuranceClaimDetail';
import CreateInsuranceClaimDialog, {
  type CompanionChoice,
} from '@/app/features/finance/pages/InsuranceClaims/Sections/CreateInsuranceClaimDialog';
import {
  InsuranceClaimStatusFilters,
  type CreateInsuranceClaimInput,
  type InsuranceClaim,
  type UpdateClaimStatusInput,
} from '@/app/features/finance/types/insuranceClaim';

export type InsuranceClaimsProps = {
  /** Already narrowed to the active status and search query by the container. */
  claims: InsuranceClaim[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
  /** Why the list is empty, resolved by the container from filter and query. */
  emptyMessage: string;
  activeStatus: string;
  onStatusChange: (status: string) => void;
  companionName: (patientId: string) => string;
  companions: CompanionChoice[];
  currency: string;
  activeClaimId: string | null;
  onSelect: (claim: InsuranceClaim) => void;
  pendingAction: ClaimAction | null;
  actionError: string | null;
  onSubmitClaim: () => void;
  onCancelClaim: () => void;
  onUpdateStatus: (payload: UpdateClaimStatusInput) => void;
  createOpen: boolean;
  onCreateOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
  creating: boolean;
  createError: string | null;
  onCreate: (input: CreateInsuranceClaimInput) => void;
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
 * The Insurance claims screen: the same header anatomy as Finance and Estimates
 * (title with a live count, an info affordance, a metrics sub-line, then the
 * status filter and page actions on the right of that row), the shared table,
 * and a detail panel for the selected claim. Presentational: every piece of
 * state and every action is handed in, so the same component drives the page,
 * its story and its test.
 */
const InsuranceClaims = ({
  claims,
  loading,
  error,
  onReload,
  emptyMessage,
  activeStatus,
  onStatusChange,
  companionName,
  companions,
  currency,
  activeClaimId,
  onSelect,
  pendingAction,
  actionError,
  onSubmitClaim,
  onCancelClaim,
  onUpdateStatus,
  createOpen,
  onCreateOpenChange,
  creating,
  createError,
  onCreate,
}: InsuranceClaimsProps) => {
  const metricsCurrency = useMemo(() => sharedCurrency(claims, currency), [claims, currency]);
  const metrics = useMemo(() => summariseClaims(claims), [claims]);
  const activeClaim = useMemo(
    () => claims.find((claim) => claim.id === activeClaimId) ?? null,
    [claims, activeClaimId]
  );

  return (
    <div className="flex flex-col gap-6 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-5! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-5!">
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
              onClick={() => onCreateOpenChange(true)}
              ariaLabel="Create a new insurance claim"
            />
          </PermissionGate>
        </div>
      </div>

      {loading && (
        <div className="h-40 rounded-2xl bg-card-hover animate-pulse" aria-hidden="true" />
      )}

      {!loading && error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-danger-100 p-3!">
          <p role="alert" className="text-body-4 text-text-error">
            {error}
          </p>
          <Secondary text="Retry" onClick={onReload} ariaLabel="Retry loading insurance claims" />
        </div>
      )}

      {!loading && !error && claims.length === 0 && (
        <div className="border border-card-border rounded-2xl px-6! py-10! text-center">
          <p className="text-body-3 text-text-primary">No insurance claims yet</p>
          <p className="text-body-4 text-text-secondary">{emptyMessage}</p>
        </div>
      )}

      {!loading && !error && claims.length > 0 && (
        <div className="flex flex-col gap-6">
          <InsuranceClaimList claims={claims} activeClaimId={activeClaimId} onSelect={onSelect} />
          {activeClaim && (
            <InsuranceClaimDetail
              claim={activeClaim}
              companionName={companionName(activeClaim.patientId)}
              pendingAction={pendingAction}
              onSubmit={onSubmitClaim}
              onCancel={onCancelClaim}
              onUpdateStatus={onUpdateStatus}
              error={actionError}
            />
          )}
        </div>
      )}

      <CreateInsuranceClaimDialog
        open={createOpen}
        setOpen={onCreateOpenChange}
        companions={companions}
        currency={currency}
        saving={creating}
        error={createError}
        onSubmit={onCreate}
      />
    </div>
  );
};

export default InsuranceClaims;
