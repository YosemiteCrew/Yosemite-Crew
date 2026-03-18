'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import InvoiceDataTable from '@/app/ui/tables/InvoiceTable';
import InvoiceInfo from '@/app/features/finance/pages/Finance/Sections/InvoiceInfo';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import { useInvoicesForPrimaryOrg } from '@/app/hooks/useInvoices';
import { Invoice } from '@yosemite-crew/types';
import Filters from '@/app/ui/filters/Filters';
import { InvoiceStatusFilters } from '@/app/features/finance/types/invoice';
import { useSearchStore } from '@/app/stores/searchStore';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import Fallback from '@/app/ui/overlays/Fallback';
import { useSubscriptionForPrimaryOrg } from '@/app/hooks/useBilling';
import { Primary } from '@/app/ui/primitives/Buttons';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { IoInformationCircleOutline } from 'react-icons/io5';

const Finance = () => {
  const invoices = useInvoicesForPrimaryOrg();
  const subscription = useSubscriptionForPrimaryOrg();
  const query = useSearchStore((s) => s.query);
  const searchParams = useSearchParams();
  const handledDeepLinkRef = useRef<string | null>(null);
  const [activeStatus, setActiveStatus] = useState('all');
  const [viewInvoice, setViewInvoice] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(invoices[0] || null);

  useEffect(() => {
    setActiveInvoice((prev) => {
      if (invoices.length === 0) return null;
      if (prev?.id) {
        const updated = invoices.find((s) => s.id === prev.id);
        if (updated) return updated;
      }
      return invoices[0];
    });
  }, [invoices]);

  useEffect(() => {
    const invoiceId = String(searchParams.get('invoiceId') ?? '').trim();
    if (!invoiceId) return;
    if (handledDeepLinkRef.current === invoiceId) return;

    const target = invoices.find((invoice) => invoice.id === invoiceId);
    if (!target) return;

    setActiveInvoice(target);
    setViewInvoice(true);
    handledDeepLinkRef.current = invoiceId;
  }, [invoices, searchParams]);

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const statusWanted = activeStatus.toLowerCase();

    return invoices.filter((item) => {
      const status = item.status?.toLowerCase();
      const matchesStatus = statusWanted === 'all' || status === statusWanted;
      const matchesQuery = !q || item.appointmentId?.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [invoices, activeStatus, query]);

  return (
    <div className="flex flex-col gap-4 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-5! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-5!">
      <PermissionGate allOf={[PERMISSIONS.ORG_EDIT]}>
        {subscription && !subscription.canAcceptPayments && (
          <div className="px-6 py-3 border border-card-border rounded-2xl w-full flex items-center justify-between gap-3 flex-col sm:flex-row">
            <div className="flex flex-col gap-1 items-center sm:items-start">
              <div className="text-heading-2 text-text-primary">Connect stripe account</div>
              <div className="text-caption-1 text-text-primary text-center! sm:text-left!">
                Stripe connect account is required for start receiving payments from pet parents
              </div>
            </div>
            <div className="shrink-0">
              <Primary
                href={`/stripe-onboarding?orgId=${subscription.orgId}`}
                text="Connect stripe"
              />
            </div>
          </div>
        )}
      </PermissionGate>
      <div className="flex justify-between items-center w-full flex-wrap gap-2">
        <div className="flex flex-col gap-1">
          <div className="text-text-primary text-heading-1 flex items-center gap-2">
            <span>
              {'Finance'}
              <span className="text-text-tertiary">{` (${invoices.length})`}</span>
            </span>
            <GlassTooltip
              content="Review invoices, monitor payment status, and open each record to see billed services, balances, and payment history."
              side="bottom"
            >
              <button
                type="button"
                aria-label="Finance info"
                className="relative top-[3px] inline-flex h-5 w-5 shrink-0 items-center justify-center leading-none text-text-secondary hover:text-text-primary transition-colors"
              >
                <IoInformationCircleOutline size={20} />
              </button>
            </GlassTooltip>
          </div>
        </div>
      </div>

      <PermissionGate allOf={[PERMISSIONS.BILLING_VIEW_ANY]} fallback={<Fallback />}>
        <div className="w-full flex flex-col gap-3">
          <Filters
            statusOptions={InvoiceStatusFilters}
            activeStatus={activeStatus}
            setActiveStatus={setActiveStatus}
          />
          <InvoiceDataTable
            setActiveInvoice={setActiveInvoice}
            setViewInvoice={setViewInvoice}
            filteredList={filteredList}
          />
        </div>
        {activeInvoice && (
          <InvoiceInfo
            showModal={viewInvoice}
            setShowModal={setViewInvoice}
            activeInvoice={activeInvoice}
          />
        )}
      </PermissionGate>
    </div>
  );
};

const ProtectedFinance = () => {
  return (
    <ProtectedRoute>
      <OrgGuard>
        <Finance />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedFinance;
