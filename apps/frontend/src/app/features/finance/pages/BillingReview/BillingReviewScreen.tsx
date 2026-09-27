'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { IoArrowForwardOutline, IoReceiptOutline } from 'react-icons/io5';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { Secondary } from '@/app/ui/primitives/Buttons';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import Fallback from '@/app/ui/overlays/Fallback';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import { useOrgStore } from '@/app/stores/orgStore';
import { listBillingReview } from '@/app/features/finance/services/billingReviewService';
import type {
  BillingReviewItem,
  BillingReviewPage,
  BillingReviewStatus,
} from '@/app/features/finance/types/billingReview';

type BillingReviewScreenProps = {
  organisationId?: string;
  loadPage?: (organisationId: string, cursor?: string | null) => Promise<BillingReviewPage>;
};

type BillingReviewListProps = {
  organisationId: string | null;
  loadPage: (organisationId: string, cursor?: string | null) => Promise<BillingReviewPage>;
};

const statusLabel: Record<BillingReviewStatus, string> = {
  MISSING_INVOICE: 'Invoice needed',
  DRAFT_INVOICE: 'Invoice in draft',
  READY_FOR_BILLING: 'Invoice ready',
};

const PAGE_SKELETON = <PageSkeleton variant="list" />;

const formatVisitDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat('en', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
};

const visitHref = (id: string) => `/appointments/${encodeURIComponent(id)}/workspace?step=INVOICE`;

const VisitCard = ({ item }: { item: BillingReviewItem }) => (
  <article className="rounded-2xl border border-card-border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-caption-1 text-text-secondary">
          {formatVisitDate(item.appointmentDate)}
        </p>
        <h2 className="mt-1 truncate text-body-2-emphasis text-text-primary">
          {item.patientName || item.appointmentType || 'Completed visit'}
        </h2>
        <p className="mt-1 text-body-4 text-text-secondary">
          {item.clientName
            ? `Client: ${item.clientName}`
            : item.appointmentType || 'Client unavailable'}
        </p>
      </div>
      <StatusPill
        label={statusLabel[item.billingStatus]}
        tone="warning"
        className="normal-case tracking-normal"
      />
    </div>
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-card-border pt-3">
      <span className="text-caption-2 text-text-tertiary">
        {item.invoiceStatus
          ? `Invoice ${item.invoiceStatus.toLowerCase().replaceAll('_', ' ')}`
          : 'No invoice on file'}
      </span>
      <Link
        href={visitHref(item.id)}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-body-4-emphasis text-action-primary hover:bg-action-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Review visit <IoArrowForwardOutline aria-hidden="true" />
      </Link>
    </div>
  </article>
);

export const BillingReviewContent = ({
  organisationId: providedOrganisationId,
  loadPage = listBillingReview,
}: BillingReviewScreenProps) => {
  const activeOrganisationId = useOrgStore((state) => state.primaryOrgId);
  const organisationId = providedOrganisationId ?? activeOrganisationId;
  return (
    <BillingReviewList
      key={organisationId ?? 'no-practice'}
      organisationId={organisationId}
      loadPage={loadPage}
    />
  );
};

const BillingReviewList = ({ organisationId, loadPage }: BillingReviewListProps) => {
  const [items, setItems] = useState<BillingReviewItem[]>([]);
  const [itemsOrganisationId, setItemsOrganisationId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(organisationId));
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const visibleItems = itemsOrganisationId === organisationId ? items : [];

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!organisationId) {
        setItems([]);
        setItemsOrganisationId(null);
        setCursor(null);
        setHasMore(false);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError('');
      try {
        const page = await loadPage(organisationId);
        if (!active) return;
        setItems(page.items);
        setItemsOrganisationId(organisationId);
        setCursor(page.nextCursor);
        setHasMore(page.hasMore);
      } catch {
        if (active) setError('We could not load the billing review list. Try again.');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [loadPage, organisationId]);

  const loadFirstPage = useCallback(async () => {
    if (!organisationId) return;
    setIsLoading(true);
    setError('');
    try {
      const page = await loadPage(organisationId);
      setItems(page.items);
      setItemsOrganisationId(organisationId);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      setError('We could not load the billing review list. Try again.');
    } finally {
      setIsLoading(false);
    }
  }, [loadPage, organisationId]);

  const loadMore = async () => {
    if (!organisationId || itemsOrganisationId !== organisationId || !hasMore || isLoadingMore)
      return;
    setIsLoadingMore(true);
    setError('');
    try {
      const page = await loadPage(organisationId, cursor);
      setItems((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      setError('We could not load more visits. Try again.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-card-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/finance"
            className="text-caption-1 text-text-secondary hover:text-text-primary"
          >
            Finance
          </Link>
          <p className="mt-3 text-overline text-text-tertiary">Billing desk</p>
          <h1 className="mt-1 text-page-title text-text-primary">Completed visits to review</h1>
          <p className="mt-2 max-w-2xl text-body-4 text-text-secondary">
            Find completed visits that still need an invoice or a billing check, then continue in
            the visit workspace.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-card-border bg-card px-3 py-2 text-caption-1 text-text-secondary">
          <IoReceiptOutline aria-hidden="true" className="text-action-primary" />
          {visibleItems.length} shown
        </div>
      </header>

      {!organisationId && (
        <p
          role="status"
          className="rounded-xl border border-card-border bg-card p-5 text-body-4 text-text-secondary"
        >
          Select a practice to view completed visits.
        </p>
      )}

      {isLoading && (
        <div role="status" aria-label="Loading billing review" className="flex flex-col gap-3">
          {[1, 2, 3].map((row) => (
            <div
              key={row}
              className="h-28 animate-pulse rounded-2xl border border-card-border bg-card-hover"
            />
          ))}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-input-border-error bg-danger-100 p-3"
        >
          <p className="text-body-4 text-text-error">{error}</p>
          <Secondary
            text="Retry"
            onClick={loadFirstPage}
            ariaLabel="Retry loading the billing review list"
          />
        </div>
      )}

      {!isLoading &&
        !error &&
        organisationId &&
        itemsOrganisationId === organisationId &&
        visibleItems.length === 0 && (
          <section className="rounded-2xl border border-card-border bg-card px-5 py-10 text-center">
            <IoReceiptOutline aria-hidden="true" className="mx-auto size-8 text-text-tertiary" />
            <h2 className="mt-3 text-body-2-emphasis text-text-primary">You’re caught up</h2>
            <p className="mx-auto mt-1 max-w-md text-body-4 text-text-secondary">
              Completed visits with a missing or unfinished invoice will appear here.
            </p>
          </section>
        )}

      {!isLoading && visibleItems.length > 0 && (
        <section aria-label="Visits needing billing review" className="flex flex-col gap-3">
          {visibleItems.map((item) => (
            <VisitCard key={item.id} item={item} />
          ))}
        </section>
      )}

      {hasMore && !isLoading && itemsOrganisationId === organisationId && (
        <button
          type="button"
          onClick={() => loadMore()}
          disabled={isLoadingMore}
          className="min-h-11 self-center rounded-xl border border-card-border bg-card px-5 text-body-4-emphasis text-text-primary transition-colors hover:bg-card-hover disabled:opacity-50"
        >
          {isLoadingMore ? 'Loading…' : 'Load more visits'}
        </button>
      )}
    </main>
  );
};

const BillingReviewScreen = () => (
  <ProtectedRoute skeleton={PAGE_SKELETON}>
    <OrgGuard skeleton={PAGE_SKELETON}>
      <Suspense fallback={PAGE_SKELETON}>
        <PermissionGate allOf={[PERMISSIONS.BILLING_VIEW_ANY]} fallback={<Fallback />}>
          <BillingReviewContent />
        </PermissionGate>
      </Suspense>
    </OrgGuard>
  </ProtectedRoute>
);

export default BillingReviewScreen;
