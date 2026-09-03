'use client';
import React, { useMemo } from 'react';
import InsuranceClaimsHeader from '@/app/features/finance/pages/InsuranceClaims/Sections/InsuranceClaimsHeader';
import InsuranceClaimsStates from '@/app/features/finance/pages/InsuranceClaims/Sections/InsuranceClaimsStates';
import InsuranceClaimList from '@/app/features/finance/pages/InsuranceClaims/Sections/InsuranceClaimList';
import InsuranceClaimDetail, {
  type ClaimAction,
} from '@/app/features/finance/pages/InsuranceClaims/Sections/InsuranceClaimDetail';
import CreateInsuranceClaimDialog, {
  type CompanionChoice,
} from '@/app/features/finance/pages/InsuranceClaims/Sections/CreateInsuranceClaimDialog';
import type {
  CreateInsuranceClaimInput,
  InsuranceClaim,
  UpdateClaimStatusInput,
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
 * The Insurance claims screen: the same header anatomy as Finance and Estimates,
 * the shared table, and a detail panel for the selected claim. Presentational -
 * every piece of state and every action is handed in, so the same component
 * drives the page, its story and its test - and composed from the header, the
 * loading/error/empty states, the list, the detail and the create dialog.
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
  const activeClaim = useMemo(
    () => claims.find((claim) => claim.id === activeClaimId) ?? null,
    [claims, activeClaimId]
  );

  return (
    <div className="flex flex-col gap-6 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-5! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-5!">
      <InsuranceClaimsHeader
        claims={claims}
        currency={currency}
        activeStatus={activeStatus}
        onStatusChange={onStatusChange}
        companions={companions}
        onCreate={() => onCreateOpenChange(true)}
      />

      <InsuranceClaimsStates
        loading={loading}
        error={error}
        onReload={onReload}
        isEmpty={claims.length === 0}
        emptyMessage={emptyMessage}
      />

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
