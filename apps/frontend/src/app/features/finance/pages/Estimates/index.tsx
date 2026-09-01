'use client';
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import Fallback from '@/app/ui/overlays/Fallback';
import { PERMISSIONS } from '@/app/lib/permissions';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { useNotify } from '@/app/hooks/useNotify';
import { useOrgStore } from '@/app/stores/orgStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { loadCompanionsForPrimaryOrg } from '@/app/features/companions/services/companionService';
import { loadInvoicesForOrgPrimaryOrg } from '@/app/features/billing/services/invoiceService';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import InvoiceStatusFilterPills from '@/app/features/finance/pages/Finance/Sections/InvoiceStatusFilterPills';
import { useEstimates } from '@/app/features/finance/hooks/useEstimates';
import {
  approveEstimate,
  convertEstimate,
  createEstimate,
  declineEstimate,
  getEstimateErrorMessage,
  markEstimateSent,
} from '@/app/features/finance/services/estimateService';
import {
  EstimateStatusFilters,
  type CreateEstimateInput,
  type Estimate,
  type EstimateStatus,
} from '@/app/features/finance/types/estimate';
import EstimateList from '@/app/features/finance/pages/Estimates/Sections/EstimateList';
import EstimateDetail, {
  type EstimateAction,
} from '@/app/features/finance/pages/Estimates/Sections/EstimateDetail';
import CreateEstimateDialog from '@/app/features/finance/pages/Estimates/Sections/CreateEstimateDialog';

const ESTIMATES_PAGE_SKELETON = <PageSkeleton variant="list" />;

const ACTION_LABELS: Record<EstimateAction, { title: string; text: string }> = {
  send: { title: 'Estimate sent', text: 'The estimate is marked as sent.' },
  approve: { title: 'Estimate approved', text: 'The estimate can now be converted to an invoice.' },
  decline: { title: 'Estimate declined', text: 'The estimate has been declined.' },
  convert: { title: 'Invoice created', text: 'The estimate has been converted to an invoice.' },
};

const runAction = (
  action: EstimateAction,
  organisationId: string,
  estimateId: string
): Promise<Estimate> => {
  switch (action) {
    case 'send':
      return markEstimateSent(organisationId, estimateId);
    case 'approve':
      return approveEstimate(organisationId, estimateId);
    case 'decline':
      return declineEstimate(organisationId, estimateId);
    case 'convert':
      return convertEstimate(organisationId, estimateId);
  }
};

const EstimatesContent = () => {
  const { notify } = useNotify();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const currency = useCurrencyForPrimaryOrg();

  const [activeStatus, setActiveStatus] = useState('all');
  const statusFilter: EstimateStatus | undefined =
    activeStatus === 'all' ? undefined : (activeStatus as EstimateStatus);

  const { estimates, loading, error, upsert, reload } = useEstimates(
    primaryOrgId ?? undefined,
    statusFilter
  );

  const [activeEstimateId, setActiveEstimateId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<EstimateAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const companionsById = useCompanionStore((s) => s.companionsById);
  const companionsIdsByOrgId = useCompanionStore((s) => s.companionsIdsByOrgId);

  // Companions are needed for two things: naming a row, and populating the
  // create picker. The estimates API returns a bare patientId, so without this
  // every row would read as a uuid.
  useEffect(() => {
    if (!primaryOrgId) return;
    if ((companionsIdsByOrgId[primaryOrgId] ?? []).length > 0) return;
    loadCompanionsForPrimaryOrg().catch((err: unknown) => {
      console.error('Failed to load companions for the estimates page:', err);
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

  const activeEstimate = useMemo(
    () => estimates.find((estimate) => estimate.id === activeEstimateId) ?? null,
    [estimates, activeEstimateId]
  );

  const handleAction = async (action: EstimateAction) => {
    if (!primaryOrgId || !activeEstimate) return;
    setPendingAction(action);
    setActionError(null);
    try {
      const updated = await runAction(action, primaryOrgId, activeEstimate.id);
      upsert(updated);
      if (action === 'convert') {
        // Converting mints a new Invoice. The user normally arrives here from
        // Finance, so the invoice store already holds an entry for this
        // organisation and useLoadInvoicesForPrimaryOrg will skip loading -
        // which leaves the new invoice absent and the "View the invoice" deep
        // link unable to find it until a full reload. Force the refetch.
        loadInvoicesForOrgPrimaryOrg({ force: true, silent: true }).catch((err: unknown) => {
          console.error('Failed to refresh invoices after converting an estimate:', err);
        });
      }
      // A status change can move the estimate out of the active filter, in which
      // case `upsert` drops it and there is no longer a row to keep selected.
      if (statusFilter && updated.status !== statusFilter) setActiveEstimateId(null);
      notify('success', ACTION_LABELS[action]);
    } catch (err: unknown) {
      const message = getEstimateErrorMessage(err, 'That action could not be completed.');
      setActionError(message);
      notify('error', { title: 'Estimate not updated', text: message });
    } finally {
      setPendingAction(null);
    }
  };

  const handleCreate = async (input: CreateEstimateInput) => {
    if (!primaryOrgId) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createEstimate(primaryOrgId, input);
      upsert(created);
      setActiveEstimateId(created.id);
      setCreateOpen(false);
      notify('success', {
        title: 'Estimate created',
        text: 'The estimate is saved as a draft.',
      });
    } catch (err: unknown) {
      const message = getEstimateErrorMessage(err, 'The estimate could not be created.');
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-5! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-5!">
      <div className="flex items-center justify-between w-full flex-wrap gap-2">
        <h1 className="text-text-primary text-heading-2">Estimates</h1>
        <div className="flex items-center gap-2">
          <Secondary href="/finance" text="Back to invoices" ariaLabel="Back to invoices" />
          <PermissionGate allOf={[PERMISSIONS.BILLING_EDIT_ANY]}>
            <Primary
              text="New estimate"
              onClick={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
              ariaLabel="Create a new estimate"
            />
          </PermissionGate>
        </div>
      </div>

      <InvoiceStatusFilterPills
        options={EstimateStatusFilters}
        activeStatus={activeStatus}
        setActiveStatus={(value) => {
          setActiveStatus(value);
          setActiveEstimateId(null);
        }}
        ariaLabel="Filter estimates by status"
      />

      {loading && (
        <div className="h-40 rounded-2xl bg-card-hover animate-pulse" aria-hidden="true" />
      )}

      {!loading && error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-danger-100 p-3!">
          <p role="alert" className="text-body-4 text-text-error">
            {error}
          </p>
          <Secondary text="Retry" onClick={reload} ariaLabel="Retry loading estimates" />
        </div>
      )}

      {!loading && !error && estimates.length === 0 && (
        <div className="border border-card-border rounded-2xl px-6! py-10! text-center">
          <p className="text-body-3 text-text-primary">No estimates yet</p>
          <p className="text-body-4 text-text-secondary">
            {activeStatus === 'all'
              ? 'Create an estimate to quote a treatment plan before it is invoiced.'
              : 'No estimate currently has this status.'}
          </p>
        </div>
      )}

      {!loading && !error && estimates.length > 0 && (
        <div className="flex flex-col gap-6">
          <EstimateList
            estimates={estimates}
            activeEstimateId={activeEstimateId}
            onSelect={(estimate) => {
              setActiveEstimateId(estimate.id);
              setActionError(null);
            }}
            companionName={companionName}
          />
          {activeEstimate && (
            <EstimateDetail
              estimate={activeEstimate}
              companionName={companionName(activeEstimate.patientId)}
              pendingAction={pendingAction}
              onAction={(action) => void handleAction(action)}
              error={actionError}
            />
          )}
        </div>
      )}

      <CreateEstimateDialog
        open={createOpen}
        setOpen={setCreateOpen}
        companions={companions}
        currency={currency}
        saving={creating}
        error={createError}
        onSubmit={(input) => void handleCreate(input)}
      />
    </div>
  );
};

const Estimates = () => (
  <PermissionGate allOf={[PERMISSIONS.BILLING_VIEW_ANY]} fallback={<Fallback />}>
    <EstimatesContent />
  </PermissionGate>
);

const ProtectedEstimates = () => (
  <ProtectedRoute skeleton={ESTIMATES_PAGE_SKELETON}>
    <OrgGuard skeleton={ESTIMATES_PAGE_SKELETON}>
      <Suspense fallback={ESTIMATES_PAGE_SKELETON}>
        <Estimates />
      </Suspense>
    </OrgGuard>
  </ProtectedRoute>
);

export default ProtectedEstimates;
