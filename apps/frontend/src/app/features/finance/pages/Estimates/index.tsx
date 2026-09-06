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
import { useSearchStore } from '@/app/stores/searchStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { loadCompanionsForPrimaryOrg } from '@/app/features/companions/services/companionService';
import { loadInvoicesForOrgPrimaryOrg } from '@/app/features/billing/services/invoiceService';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { formatMoneyPrecise, sharedCurrency } from '@/app/lib/money';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { IoInformationCircleOutline } from 'react-icons/io5';
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
import EstimateList, {
  type EstimateCompanion,
} from '@/app/features/finance/pages/Estimates/Sections/EstimateList';
import PhoneEstimateList from '@/app/features/finance/pages/Estimates/Sections/PhoneEstimateList';
// Default import, matching the sibling `Finance/index.tsx`: the finance page
// tests mock this module's default export, and a named import here would read
// as `undefined` under that mock.
import useIsPhone from '@/app/ui/layout/PhoneShell/useIsPhone';
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

/**
 * Why the list is empty, which is three different situations: a search that
 * matched nothing, a status filter with no members, or an organisation with no
 * estimates at all. Extracted rather than nested in the JSX - Sonar S3358
 * rejects a nested ternary, and the branches read better named.
 */
const emptyListMessage = (
  hasQuery: boolean,
  hasAnyEstimate: boolean,
  activeStatus: string
): string => {
  if (hasQuery && hasAnyEstimate) return 'No estimate matches that search.';
  if (activeStatus !== 'all') return 'No estimate currently has this status.';
  return 'Create an estimate to quote a treatment plan before it is invoiced.';
};

/**
 * The two figures a practice actually asks of an estimates list: what is still
 * waiting on the client, and what they have already agreed to. DECLINED,
 * EXPIRED and CONVERTED are excluded from both - a converted estimate's money
 * is counted on the invoice it became, so adding it here would double it.
 */
const summariseEstimates = (estimates: Estimate[]) =>
  estimates.reduce(
    (totals, estimate) => {
      if (estimate.status === 'DRAFT' || estimate.status === 'SENT') {
        return { ...totals, awaiting: totals.awaiting + estimate.total };
      }
      if (estimate.status === 'APPROVED') {
        return { ...totals, approved: totals.approved + estimate.total };
      }
      return totals;
    },
    { awaiting: 0, approved: 0 }
  );

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
  const isPhone = useIsPhone();
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const currency = useCurrencyForPrimaryOrg();

  const query = useSearchStore((s) => s.query);
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
  const [companionsError, setCompanionsError] = useState<string | null>(null);
  const [companionsReloadToken, setCompanionsReloadToken] = useState(0);

  const companionsById = useCompanionStore((s) => s.companionsById);
  const companionsIdsByOrgId = useCompanionStore((s) => s.companionsIdsByOrgId);

  // Companions are needed for two things: naming a row, and populating the
  // create picker. The estimates API returns a bare patientId, so without this
  // every row would read as a uuid.
  useEffect(() => {
    if (!primaryOrgId) return;
    if ((companionsIdsByOrgId[primaryOrgId] ?? []).length > 0) return;
    // Surfaced, not just logged: without companions the picker is empty, so
    // "New estimate" leads to a dialog that can only tell the user to choose a
    // companion that is not there. The reset lives in the retry handler rather
    // than here - a synchronous setState inside an effect cascades renders.
    loadCompanionsForPrimaryOrg().catch(() => {
      setCompanionsError('Companions could not be loaded, so a new estimate cannot be started.');
    });
  }, [primaryOrgId, companionsIdsByOrgId, companionsReloadToken]);

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

  // The row needs the photo and species too, so the avatar disc is tinted and
  // the fallback image matches the animal rather than defaulting to 'other'.
  const companionFor = useCallback(
    (patientId: string): EstimateCompanion => {
      const stored = companionsById[patientId];
      return {
        name: stored?.name || 'Unknown companion',
        photoUrl: stored?.photoUrl,
        speciesCode: stored?.speciesCode,
      };
    },
    [companionsById]
  );

  // The shared finance header stays visible on this route and already writes to
  // the search store, so the control looked functional while doing nothing.
  // Matching on the companion name is what a user typing there would expect.
  const visibleEstimates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return estimates;
    return estimates.filter((estimate) =>
      companionName(estimate.patientId).toLowerCase().includes(needle)
    );
  }, [estimates, query, companionName]);

  const metricsCurrency = useMemo(() => sharedCurrency(estimates, currency), [estimates, currency]);
  const metrics = useMemo(() => summariseEstimates(estimates), [estimates]);

  const activeEstimate = useMemo(
    () => visibleEstimates.find((estimate) => estimate.id === activeEstimateId) ?? null,
    [visibleEstimates, activeEstimateId]
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
      // A new estimate is always DRAFT. Under any other status filter `upsert`
      // correctly refuses it, so selecting the id and reporting success would
      // leave an unchanged list with nothing selected. Move to the filter the
      // new estimate actually lives under first.
      if (statusFilter && created.status !== statusFilter) {
        setActiveStatus(created.status);
      }
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
      {/*
        Deliberately the same header as Finance: title with a live count, an
        info affordance, a metrics sub-line, then the status filter and the
        page actions on the right of that same row. Estimates is reached from
        Finance and reads as the same surface, so a second layout here made the
        two pages look unrelated.
      */}
      <div className="flex items-center justify-between w-full flex-wrap gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-page-title">
              {'Estimates'}{' '}
              <span className="text-page-title-count">{`(${visibleEstimates.length})`}</span>
            </h1>
            <GlassTooltip
              content="Quote a treatment plan before it is billed. Send an estimate for approval, then convert an approved one into an invoice."
              side="bottom"
            >
              <button
                type="button"
                aria-label="Estimates info"
                className="inline-flex size-5 shrink-0 items-center justify-center leading-none translate-y-px text-text-secondary hover:text-text-primary transition-colors"
              >
                <IoInformationCircleOutline size={17} />
              </button>
            </GlassTooltip>
          </div>
          <p className="text-[13.5px] text-text-secondary">
            {`${formatMoneyPrecise(metrics.awaiting, metricsCurrency)} awaiting decision · ${formatMoneyPrecise(
              metrics.approved,
              metricsCurrency
            )} approved`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/*
            Seven non-shrinking pills exceed a phone's width, so the group wraps
            here rather than pushing the page into a sideways scroll.
          */}
          <InvoiceStatusFilterPills
            options={EstimateStatusFilters}
            activeStatus={activeStatus}
            setActiveStatus={(value) => {
              setActiveStatus(value);
              setActiveEstimateId(null);
            }}
            ariaLabel="Filter estimates by status"
            className="flex-wrap justify-end"
          />
          <Secondary href="/finance" text="Invoices" ariaLabel="Back to invoices" />
          <PermissionGate allOf={[PERMISSIONS.BILLING_EDIT_ANY]}>
            <Primary
              text="New estimate"
              isDisabled={companions.length === 0}
              onClick={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
              ariaLabel="Create a new estimate"
            />
          </PermissionGate>
        </div>
      </div>

      {companionsError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-danger-100 p-3!">
          <p role="alert" className="text-body-4 text-text-error">
            {companionsError}
          </p>
          <Secondary
            text="Retry"
            onClick={() => {
              setCompanionsError(null);
              setCompanionsReloadToken((token) => token + 1);
            }}
            ariaLabel="Retry loading companions"
          />
        </div>
      )}

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

      {!loading && !error && visibleEstimates.length === 0 && (
        <div className="border border-card-border rounded-2xl px-6! py-10! text-center">
          <p className="text-body-3 text-text-primary">No estimates yet</p>
          <p className="text-body-4 text-text-secondary">
            {emptyListMessage(Boolean(query.trim()), estimates.length > 0, activeStatus)}
          </p>
        </div>
      )}

      {!loading && !error && visibleEstimates.length > 0 && (
        <div className="flex flex-col gap-6">
          {isPhone ? (
            <PhoneEstimateList
              estimates={visibleEstimates}
              activeEstimateId={activeEstimateId}
              onSelect={(estimate) => {
                setActiveEstimateId(estimate.id);
                setActionError(null);
              }}
              companion={companionFor}
            />
          ) : (
            <EstimateList
              estimates={visibleEstimates}
              activeEstimateId={activeEstimateId}
              onSelect={(estimate) => {
                setActiveEstimateId(estimate.id);
                setActionError(null);
              }}
              companion={companionFor}
            />
          )}
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
