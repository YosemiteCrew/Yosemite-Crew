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
import { getPlannerLayoutClassNames, usePlannerAutoLock } from '@/app/hooks/usePlannerLayout';

const Finance = () => {
  const invoices = useInvoicesForPrimaryOrg();
  const subscription = useSubscriptionForPrimaryOrg();
  const query = useSearchStore((s) => s.query);
  const searchParams = useSearchParams();
  const handledDeepLinkRef = useRef<string | null>(null);
  const [activeStatus, setActiveStatus] = useState('all');
  const [viewInvoice, setViewInvoice] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(invoices[0] || null);
  const { plannerSectionRef } = usePlannerAutoLock({ activeView: 'list', topOffset: 72 });

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
  const { wrapperClassName, plannerSectionClassName } = getPlannerLayoutClassNames({
    activeView: 'list',
    listWrapperClassName:
      'w-full flex flex-col gap-3 h-[calc(100vh-236px)] min-h-[540px] max-h-[calc(100vh-236px)] lg:sticky lg:top-4 lg:mb-0 lg:h-[calc(100dvh-104px)] lg:min-h-[calc(100dvh-104px)] lg:max-h-[calc(100dvh-104px)]',
    plannerClassName: '',
  });

  return (
    <div className="relative min-w-0 flex h-full min-h-0 flex-col gap-4 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-3! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-3!">
      <PermissionGate allOf={[PERMISSIONS.ORG_EDIT]}>
        {subscription && !subscription.canAcceptPayments && (
          <section
            className="px-6 py-3 border border-card-border rounded-2xl w-full flex items-center justify-between gap-3 flex-col sm:flex-row"
            aria-labelledby="finance-stripe-banner-title"
          >
            <div className="flex flex-col gap-1 items-center sm:items-start">
              <h2 id="finance-stripe-banner-title" className="text-heading-2 text-text-primary">
                Connect Stripe account
              </h2>
              <div className="text-caption-1 text-text-primary text-center! sm:text-left!">
                Connect Stripe before you start receiving card payments from pet parents.
              </div>
            </div>
            <div className="shrink-0">
              <Primary
                href={`/stripe-onboarding?orgId=${subscription.orgId}`}
                text="Connect stripe"
                ariaLabel="Connect Stripe account"
              />
            </div>
          </section>
        )}
      </PermissionGate>
      <PermissionGate allOf={[PERMISSIONS.BILLING_VIEW_ANY]} fallback={<Fallback />}>
        <div className={wrapperClassName}>
          <div className="flex items-center justify-between w-full flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h1 className="text-text-primary text-heading-2">
                {'Finance'}
                <span className="text-body-2 text-text-tertiary">{` (${invoices.length})`}</span>
              </h1>
              <GlassTooltip
                content="Review invoices, monitor payment status, and open each record to see billed services, balances, and payment history."
                side="bottom"
              >
                <button
                  type="button"
                  aria-label="Finance info"
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center leading-none translate-y-px text-text-secondary hover:text-text-primary transition-colors"
                >
                  <IoInformationCircleOutline size={20} />
                </button>
              </GlassTooltip>
            </div>
            <Filters
              statusOptions={InvoiceStatusFilters}
              activeStatus={activeStatus}
              setActiveStatus={setActiveStatus}
              className="w-auto"
            />
          </div>
          <div ref={plannerSectionRef} className={plannerSectionClassName}>
            <InvoiceDataTable
              setActiveInvoice={setActiveInvoice}
              setViewInvoice={setViewInvoice}
              filteredList={filteredList}
            />
          </div>
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
