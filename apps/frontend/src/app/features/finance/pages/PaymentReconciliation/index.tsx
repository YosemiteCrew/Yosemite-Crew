'use client';
import React, { Suspense, useState } from 'react';
import { IoInformationCircleOutline } from 'react-icons/io5';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import Fallback from '@/app/ui/overlays/Fallback';
import { PERMISSIONS } from '@/app/lib/permissions';
import { Secondary } from '@/app/ui/primitives/Buttons';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { useOrgStore } from '@/app/stores/orgStore';
import InvoiceStatusFilterPills from '@/app/features/finance/pages/Finance/Sections/InvoiceStatusFilterPills';
import { useProviderReceipts } from '@/app/features/finance/hooks/useProviderReceipts';
import {
  ALL_STATUSES_KEY,
  RECONCILIATION_STATUS_FILTERS,
  toStatusFilter,
  utcDayEnd,
  utcDayStart,
} from '@/app/features/finance/pages/PaymentReconciliation/receiptPresentation';
import ReconciliationTable from '@/app/features/finance/pages/PaymentReconciliation/Sections/ReconciliationTable';

const RECONCILIATION_PAGE_SKELETON = <PageSkeleton variant="list" />;

const TOOLTIP_COPY =
  'Every card payment the practice captures is journalled here the moment it lands, ' +
  'whether or not an invoice could be found for it. Work down the queue to see what ' +
  'has been applied, what is still unallocated, and what has been refunded.';

const dateFieldClass =
  'rounded-2xl border border-input-border-default focus-within:border-input-border-active ' +
  'bg-transparent px-4 py-2.5 text-body-4 text-text-primary outline-none';

const PaymentReconciliationContent = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  const [activeStatus, setActiveStatus] = useState<string>(ALL_STATUSES_KEY);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { receipts, loading, loadingMore, error, hasMore, loadMore, reload } = useProviderReceipts(
    primaryOrgId ?? undefined,
    toStatusFilter(activeStatus),
    utcDayStart(fromDate),
    utcDayEnd(toDate)
  );

  const isFiltered = activeStatus !== ALL_STATUSES_KEY || Boolean(fromDate) || Boolean(toDate);

  return (
    <div className="flex flex-col gap-6 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-5! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-5!">
      <div className="flex items-center justify-between w-full flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-page-title">Payment reconciliation</h1>
          <GlassTooltip content={TOOLTIP_COPY} side="bottom">
            <button
              type="button"
              aria-label="Payment reconciliation info"
              className="inline-flex size-5 shrink-0 items-center justify-center leading-none translate-y-px text-text-secondary hover:text-text-primary transition-colors"
            >
              <IoInformationCircleOutline size={20} />
            </button>
          </GlassTooltip>
        </div>
        <Secondary href="/finance" text="Back to invoices" ariaLabel="Back to invoices" />
      </div>

      <div className="flex flex-col gap-3">
        <InvoiceStatusFilterPills
          options={RECONCILIATION_STATUS_FILTERS}
          activeStatus={activeStatus}
          setActiveStatus={setActiveStatus}
          ariaLabel="Filter captured payments by state"
          className="flex-wrap"
        />

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="reconciliation-captured-from"
              className="text-caption-2 font-bold text-text-tertiary"
            >
              Captured from (UTC)
            </label>
            <input
              id="reconciliation-captured-from"
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
              className={dateFieldClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="reconciliation-captured-to"
              className="text-caption-2 font-bold text-text-tertiary"
            >
              Captured to (UTC)
            </label>
            <input
              id="reconciliation-captured-to"
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              className={dateFieldClass}
            />
          </div>
        </div>
        {/*
          The window is stated rather than inferred. The endpoint takes an
          instant with an offset for exactly this reason, so the screen has to
          say which day boundary it sent.
        */}
        <p className="text-body-4 text-text-secondary">
          {
            'Dates select whole UTC days, so the same range selects the same payments wherever it is read.'
          }
        </p>
      </div>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-danger-100 p-3!">
          <p role="alert" className="text-body-4 text-text-error">
            {error}
          </p>
          <Secondary
            text="Retry"
            onClick={reload}
            ariaLabel="Retry loading the reconciliation queue"
          />
        </div>
      )}

      <ReconciliationTable
        receipts={receipts}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        isFiltered={isFiltered}
        onLoadMore={loadMore}
      />
    </div>
  );
};

const PaymentReconciliation = () => (
  <PermissionGate allOf={[PERMISSIONS.BILLING_VIEW_ANY]} fallback={<Fallback />}>
    <PaymentReconciliationContent />
  </PermissionGate>
);

const ProtectedPaymentReconciliation = () => (
  <ProtectedRoute skeleton={RECONCILIATION_PAGE_SKELETON}>
    <OrgGuard skeleton={RECONCILIATION_PAGE_SKELETON}>
      <Suspense fallback={RECONCILIATION_PAGE_SKELETON}>
        <PaymentReconciliation />
      </Suspense>
    </OrgGuard>
  </ProtectedRoute>
);

export default ProtectedPaymentReconciliation;
