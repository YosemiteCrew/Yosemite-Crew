'use client';
import React, { useMemo } from 'react';
import InsuranceClaimsHeader from '@/app/features/finance/pages/InsuranceClaims/Sections/InsuranceClaimsHeader';
import InsuranceClaimsStates from '@/app/features/finance/pages/InsuranceClaims/Sections/InsuranceClaimsStates';
import InsuranceClaimList from '@/app/features/finance/pages/InsuranceClaims/Sections/InsuranceClaimList';
import PhoneInsuranceClaimList from '@/app/features/finance/pages/InsuranceClaims/Sections/PhoneInsuranceClaimList';
import useIsPhone from '@/app/ui/layout/PhoneShell/useIsPhone';
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

type InsuranceClaimsResultsProps = Pick<
  InsuranceClaimsProps,
  | 'claims'
  | 'loading'
  | 'error'
  | 'onReload'
  | 'emptyMessage'
  | 'activeClaimId'
  | 'onSelect'
  | 'companionName'
  | 'pendingAction'
  | 'onSubmitClaim'
  | 'onCancelClaim'
  | 'onUpdateStatus'
  | 'actionError'
> & { activeClaim: InsuranceClaim | null };

const InsuranceClaimsResults = (props: InsuranceClaimsResultsProps) => {
  /* The two lists take identical props, so the breakpoint chooses the component
     and nothing else. Written as a swap rather than two JSX branches: branching
     duplicates every prop, and a prop added to one arm and not the other is a
     difference no type catches. */
  const ClaimList = useIsPhone() ? PhoneInsuranceClaimList : InsuranceClaimList;
  return (
    <>
      <InsuranceClaimsStates
        loading={props.loading}
        error={props.error}
        onReload={props.onReload}
        isEmpty={props.claims.length === 0}
        emptyMessage={props.emptyMessage}
      />
      {!props.loading && !props.error && props.claims.length > 0 && (
        <div className="flex flex-col gap-6">
          <ClaimList
            claims={props.claims}
            activeClaimId={props.activeClaimId}
            onSelect={props.onSelect}
          />
          {props.activeClaim && (
            <InsuranceClaimDetail
              claim={props.activeClaim}
              companionName={props.companionName(props.activeClaim.patientId)}
              pendingAction={props.pendingAction}
              onSubmit={props.onSubmitClaim}
              onCancel={props.onCancelClaim}
              onUpdateStatus={props.onUpdateStatus}
              error={props.actionError}
            />
          )}
        </div>
      )}
    </>
  );
};

/**
 * The Insurance claims screen: the same header anatomy as Finance and Estimates,
 * the shared table, and a detail panel for the selected claim. Presentational -
 * every piece of state and every action is handed in, so the same component
 * drives the page, its story and its test - and composed from the header, the
 * loading/error/empty states, the list, the detail and the create dialog.
 */
const InsuranceClaims = (props: InsuranceClaimsProps) => {
  const activeClaim = useMemo(
    () => props.claims.find((claim) => claim.id === props.activeClaimId) ?? null,
    [props.claims, props.activeClaimId]
  );

  return (
    <div className="flex flex-col gap-6 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-5! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-5!">
      <InsuranceClaimsHeader
        claims={props.claims}
        currency={props.currency}
        activeStatus={props.activeStatus}
        onStatusChange={props.onStatusChange}
        companions={props.companions}
        onCreate={() => props.onCreateOpenChange(true)}
      />
      <InsuranceClaimsResults {...props} activeClaim={activeClaim} />
      <CreateInsuranceClaimDialog
        open={props.createOpen}
        setOpen={props.onCreateOpenChange}
        companions={props.companions}
        currency={props.currency}
        saving={props.creating}
        error={props.createError}
        onSubmit={props.onCreate}
      />
    </div>
  );
};

export default InsuranceClaims;
