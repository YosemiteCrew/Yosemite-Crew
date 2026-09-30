'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
} from 'react';
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
import { getPreferredTimeZone } from '@/app/lib/timezone';
import { formatMoneyPrecise } from '@/app/lib/money';
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
  UNBILLED_CHARGES: 'Charges not invoiced',
};

const invoiceStatusLabel: Record<string, string> = {
  PENDING: 'Invoice pending',
  AWAITING_PAYMENT: 'Invoice awaiting payment',
  PAID: 'Invoice paid',
  FAILED: 'Invoice payment failed',
  CANCELLED: 'Invoice cancelled',
  REFUNDED: 'Invoice refunded',
};

// One invoice per visit, so its total is shown in that invoice's own currency
// and never added to another visit's total.
const invoiceSummary = (item: BillingReviewItem): string => {
  if (!item.invoiceStatus) return 'No invoice on file';
  const status = invoiceStatusLabel[item.invoiceStatus] ?? 'Invoice on file';
  return item.invoiceTotal === null
    ? status
    : `${status} · ${formatMoneyPrecise(item.invoiceTotal, item.currency ?? undefined)}`;
};

const PAGE_SKELETON = <PageSkeleton variant="list" />;
const subscribeToTimezone = (onChange: () => void) => {
  globalThis.window?.addEventListener('yc:timezone-changed', onChange);
  return () => globalThis.window?.removeEventListener('yc:timezone-changed', onChange);
};

const getServerTimezone = () => 'UTC';

const visitHref = (id: string) => `/appointments/${encodeURIComponent(id)}/workspace?step=INVOICE`;

const VisitDate = ({ value }: { value: string }) => {
  const timeZone = useSyncExternalStore(
    subscribeToTimezone,
    getPreferredTimeZone,
    getServerTimezone
  );
  const formatter = useMemo(
    () => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone }),
    [timeZone]
  );
  const date = new Date(value);
  const label = Number.isNaN(date.getTime()) ? 'Date unavailable' : formatter.format(date);

  return <time dateTime={value}>{label}</time>;
};

const VisitCard = ({ item }: { item: BillingReviewItem }) => (
  <article className="rounded-2xl border border-card-border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-caption-1 text-text-secondary">
          <VisitDate value={item.appointmentDate} />
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
      <span className="text-caption-2 text-text-tertiary">{invoiceSummary(item)}</span>
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

type BillingReviewListState = {
  items: BillingReviewItem[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string;
};

type BillingReviewListAction =
  | { type: 'reset' }
  | { type: 'load-start' }
  | { type: 'load-success'; page: BillingReviewPage }
  | { type: 'load-error'; message: string }
  | { type: 'load-more-start' }
  | { type: 'load-more-success'; page: BillingReviewPage }
  | { type: 'load-more-error'; message: string };

const billingReviewListReducer = (
  state: BillingReviewListState,
  action: BillingReviewListAction
): BillingReviewListState => {
  switch (action.type) {
    case 'reset':
      return { items: [], hasMore: false, isLoading: false, isLoadingMore: false, error: '' };
    case 'load-start':
      return { ...state, isLoading: true, error: '' };
    case 'load-success':
      return { ...state, items: action.page.items, hasMore: action.page.hasMore, isLoading: false };
    case 'load-error':
      return { ...state, isLoading: false, error: action.message };
    case 'load-more-start':
      return { ...state, isLoadingMore: true, error: '' };
    case 'load-more-success':
      return {
        ...state,
        items: [...state.items, ...action.page.items],
        hasMore: action.page.hasMore,
        isLoadingMore: false,
      };
    case 'load-more-error':
      return { ...state, isLoadingMore: false, error: action.message };
    default:
      return state;
  }
};

const useBillingReviewList = (
  organisationId: string | null,
  loadPage: BillingReviewListProps['loadPage']
) => {
  const [state, dispatch] = useReducer(billingReviewListReducer, {
    items: [],
    hasMore: false,
    isLoading: Boolean(organisationId),
    isLoadingMore: false,
    error: '',
  });
  const cursor = useRef<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!organisationId) {
        cursor.current = null;
        dispatch({ type: 'reset' });
        return;
      }
      dispatch({ type: 'load-start' });
      try {
        const page = await loadPage(organisationId);
        if (!active) return;
        cursor.current = page.nextCursor;
        dispatch({ type: 'load-success', page });
      } catch {
        if (active)
          dispatch({
            type: 'load-error',
            message: 'We could not load the billing review list. Try again.',
          });
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [loadPage, organisationId]);

  const loadFirstPage = useCallback(async () => {
    if (!organisationId) return;
    dispatch({ type: 'load-start' });
    try {
      const page = await loadPage(organisationId);
      if (!mounted.current) return;
      cursor.current = page.nextCursor;
      dispatch({ type: 'load-success', page });
    } catch {
      if (mounted.current)
        dispatch({
          type: 'load-error',
          message: 'We could not load the billing review list. Try again.',
        });
    }
  }, [loadPage, organisationId]);

  const loadMore = useCallback(async () => {
    if (!organisationId || !state.hasMore || state.isLoadingMore) return;
    dispatch({ type: 'load-more-start' });
    try {
      const page = await loadPage(organisationId, cursor.current);
      if (!mounted.current) return;
      cursor.current = page.nextCursor;
      dispatch({ type: 'load-more-success', page });
    } catch {
      if (mounted.current)
        dispatch({ type: 'load-more-error', message: 'We could not load more visits. Try again.' });
    }
  }, [loadPage, organisationId, state.hasMore, state.isLoadingMore]);

  return { ...state, loadFirstPage, loadMore };
};

const BillingReviewList = ({ organisationId, loadPage }: BillingReviewListProps) => {
  const { items, hasMore, isLoading, isLoadingMore, error, loadFirstPage, loadMore } =
    useBillingReviewList(organisationId, loadPage);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
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
          {items.length} shown
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

      {!isLoading && !error && organisationId && items.length === 0 && (
        <section className="rounded-2xl border border-card-border bg-card px-5 py-10 text-center">
          <IoReceiptOutline aria-hidden="true" className="mx-auto size-8 text-text-tertiary" />
          <h2 className="mt-3 text-body-2-emphasis text-text-primary">You’re caught up</h2>
          <p className="mx-auto mt-1 max-w-md text-body-4 text-text-secondary">
            Completed visits with a missing or draft invoice, or charges not yet invoiced, will
            appear here.
          </p>
        </section>
      )}

      {!isLoading && items.length > 0 && (
        <section aria-label="Visits needing billing review" className="flex flex-col gap-3">
          {items.map((item) => (
            <VisitCard key={item.id} item={item} />
          ))}
        </section>
      )}

      {hasMore && !isLoading && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isLoadingMore}
          className="min-h-11 self-center rounded-xl border border-card-border bg-card px-5 text-body-4-emphasis text-text-primary transition-colors hover:bg-card-hover disabled:opacity-50"
        >
          {isLoadingMore ? 'Loading…' : 'Load more visits'}
        </button>
      )}
    </div>
  );
};

const BillingReviewScreen = () => (
  <ProtectedRoute skeleton={PAGE_SKELETON}>
    <OrgGuard skeleton={PAGE_SKELETON}>
      <Suspense fallback={PAGE_SKELETON}>
        <PermissionGate
          allOf={[PERMISSIONS.BILLING_VIEW_ANY, PERMISSIONS.APPOINTMENTS_VIEW_ANY]}
          fallback={<Fallback />}
        >
          <BillingReviewContent />
        </PermissionGate>
      </Suspense>
    </OrgGuard>
  </ProtectedRoute>
);

export default BillingReviewScreen;
