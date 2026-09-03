'use client';
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import Fallback from '@/app/ui/overlays/Fallback';
import { PERMISSIONS } from '@/app/lib/permissions';
import { useNotify } from '@/app/hooks/useNotify';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSearchStore } from '@/app/stores/searchStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { loadCompanionsForPrimaryOrg } from '@/app/features/companions/services/companionService';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { useInsuranceClaims } from '@/app/features/finance/hooks/useInsuranceClaims';
import {
  cancelInsuranceClaim,
  createInsuranceClaim,
  getClaimErrorMessage,
  submitInsuranceClaim,
  updateInsuranceClaimStatus,
} from '@/app/features/finance/services/insuranceClaimService';
import {
  claimStatusLabel,
  type CreateInsuranceClaimInput,
  type InsuranceClaim,
  type InsuranceClaimStatus,
  type UpdateClaimStatusInput,
} from '@/app/features/finance/types/insuranceClaim';
import InsuranceClaims from '@/app/features/finance/pages/InsuranceClaims/InsuranceClaims';
import type { ClaimAction } from '@/app/features/finance/pages/InsuranceClaims/Sections/InsuranceClaimDetail';

const CLAIMS_PAGE_SKELETON = <PageSkeleton variant="list" />;

/**
 * Why the list is empty: a search that matched nothing, a status filter with no
 * members, or an organisation with no claims at all. Named rather than nested in
 * JSX - Sonar S3358 rejects a nested ternary, and the branches read better here.
 */
const emptyListMessage = (
  hasQuery: boolean,
  hasAnyClaim: boolean,
  activeStatus: string
): string => {
  if (hasQuery && hasAnyClaim) return 'No claim matches that search.';
  if (activeStatus !== 'all')
    return `No claim is currently ${claimStatusLabel(activeStatus as InsuranceClaimStatus).toLowerCase()}.`;
  return 'File a claim to recover a treatment cost from a pet parent’s insurer.';
};

const InsuranceClaimsContent = () => {
  const { notify } = useNotify();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const currency = useCurrencyForPrimaryOrg();

  const query = useSearchStore((s) => s.query);
  const [activeStatus, setActiveStatus] = useState('all');
  const statusFilter: InsuranceClaimStatus | undefined =
    activeStatus === 'all' ? undefined : (activeStatus as InsuranceClaimStatus);

  const { claims, loading, error, upsert, reload } = useInsuranceClaims(
    primaryOrgId ?? undefined,
    statusFilter
  );

  const [activeClaimId, setActiveClaimId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ClaimAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const companionsById = useCompanionStore((s) => s.companionsById);
  const companionsIdsByOrgId = useCompanionStore((s) => s.companionsIdsByOrgId);

  // Companions name each row and populate the create picker; the claims API
  // returns a bare patientId, so without them a row would read as a uuid.
  useEffect(() => {
    if (!primaryOrgId) return;
    if ((companionsIdsByOrgId[primaryOrgId] ?? []).length > 0) return;
    loadCompanionsForPrimaryOrg().catch(() => {
      /* The picker simply stays empty and "New claim" is disabled. */
    });
  }, [primaryOrgId, companionsIdsByOrgId]);

  const companions = useMemo(() => {
    if (!primaryOrgId) return [];
    return (companionsIdsByOrgId[primaryOrgId] ?? []).flatMap((id) => {
      const companion = companionsById[id];
      return companion ? [{ id: companion.id, name: companion.name || 'Unnamed companion' }] : [];
    });
  }, [primaryOrgId, companionsById, companionsIdsByOrgId]);

  const companionName = useCallback(
    (patientId: string) => companionsById[patientId]?.name || 'Unknown companion',
    [companionsById]
  );

  // The shared finance header writes to the search store, so match on the fields
  // a user typing there would expect: the companion, the insurer, or the policy.
  const visibleClaims = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return claims;
    return claims.filter((claim) =>
      [companionName(claim.patientId), claim.insurerName, claim.policyNumber]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [claims, query, companionName]);

  const runAction = async (action: ClaimAction, work: () => Promise<InsuranceClaim>) => {
    if (!primaryOrgId) return;
    setPendingAction(action);
    setActionError(null);
    try {
      const updated = await work();
      upsert(updated);
      if (statusFilter && updated.status !== statusFilter) setActiveClaimId(null);
      notify('success', { title: 'Claim updated', text: 'The claim has been updated.' });
    } catch (err: unknown) {
      const message = getClaimErrorMessage(err, 'That action could not be completed.');
      setActionError(message);
      notify('error', { title: 'Claim not updated', text: message });
    } finally {
      setPendingAction(null);
    }
  };

  const activeClaim = useMemo(
    () => visibleClaims.find((claim) => claim.id === activeClaimId) ?? null,
    [visibleClaims, activeClaimId]
  );

  const handleSubmitClaim = () => {
    if (!primaryOrgId || !activeClaim) return;
    void runAction('submit', () => submitInsuranceClaim(primaryOrgId, activeClaim.id));
  };

  const handleCancelClaim = () => {
    if (!primaryOrgId || !activeClaim) return;
    void runAction('cancel', () => cancelInsuranceClaim(primaryOrgId, activeClaim.id));
  };

  const handleUpdateStatus = (payload: UpdateClaimStatusInput) => {
    if (!primaryOrgId || !activeClaim) return;
    void runAction('status', () =>
      updateInsuranceClaimStatus(primaryOrgId, activeClaim.id, payload)
    );
  };

  const handleCreate = async (input: CreateInsuranceClaimInput) => {
    if (!primaryOrgId) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createInsuranceClaim(primaryOrgId, input);
      // A new claim is always DRAFT. Move to the filter it lives under first, so
      // selecting it does not leave an unchanged list with nothing selected.
      if (statusFilter && created.status !== statusFilter) setActiveStatus(created.status);
      upsert(created);
      setActiveClaimId(created.id);
      setCreateOpen(false);
      notify('success', { title: 'Claim created', text: 'The claim is saved as a draft.' });
    } catch (err: unknown) {
      setCreateError(getClaimErrorMessage(err, 'The claim could not be created.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <InsuranceClaims
      claims={visibleClaims}
      loading={loading}
      error={error}
      onReload={reload}
      emptyMessage={emptyListMessage(Boolean(query.trim()), claims.length > 0, activeStatus)}
      activeStatus={activeStatus}
      onStatusChange={(value) => {
        setActiveStatus(value);
        setActiveClaimId(null);
      }}
      companionName={companionName}
      companions={companions}
      currency={currency}
      activeClaimId={activeClaimId}
      onSelect={(claim) => {
        setActiveClaimId(claim.id);
        setActionError(null);
      }}
      pendingAction={pendingAction}
      actionError={actionError}
      onSubmitClaim={handleSubmitClaim}
      onCancelClaim={handleCancelClaim}
      onUpdateStatus={handleUpdateStatus}
      createOpen={createOpen}
      onCreateOpenChange={setCreateOpen}
      creating={creating}
      createError={createError}
      onCreate={(input) => void handleCreate(input)}
    />
  );
};

const InsuranceClaimsPage = () => (
  <PermissionGate allOf={[PERMISSIONS.BILLING_VIEW_ANY]} fallback={<Fallback />}>
    <InsuranceClaimsContent />
  </PermissionGate>
);

const ProtectedInsuranceClaims = () => (
  <ProtectedRoute skeleton={CLAIMS_PAGE_SKELETON}>
    <OrgGuard skeleton={CLAIMS_PAGE_SKELETON}>
      <Suspense fallback={CLAIMS_PAGE_SKELETON}>
        <InsuranceClaimsPage />
      </Suspense>
    </OrgGuard>
  </ProtectedRoute>
);

export default ProtectedInsuranceClaims;
