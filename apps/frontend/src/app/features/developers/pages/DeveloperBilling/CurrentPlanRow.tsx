'use client';
import React from 'react';

import { Secondary } from '@/app/ui/primitives/Buttons';
import type { DeveloperPlanTier, DeveloperSubscription } from '@/app/services/developerBilling';

/**
 * ISO dates, matching KeyTable's `formatDate` - the two screens are one portal
 * and were printing the same kind of date two ways ("9/3/2026" here against
 * "2026-09-03" on API keys).
 *
 * KeyTable's reasoning applies here unchanged and had simply not been carried
 * across: this is a client component that renders during SSR too, so
 * `toLocaleDateString` produces the server's locale on one pass and the reader's
 * on the other and React reports a hydration mismatch
 * (react-doctor/no-locale-format-in-render). `toISOString` is UTC by definition,
 * so both passes agree - and an unambiguous sortable date is the better read for
 * a billing period a developer is reconciling against an invoice.
 */
const isoDate = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toISOString().slice(0, 10);
};

const formatPeriod = (start: string | null, end: string | null): string => {
  if (!start || !end) return '';
  return `${isoDate(start)} – ${isoDate(end)}`;
};

/**
 * Reports the STATUS, not just the tier. A failed payment shows "Past due" where
 * "Pro" would be, because the plan itself is still Pro - access is not revoked
 * the moment a charge fails.
 */
const PlanBadge = ({ plan, status }: { plan: DeveloperPlanTier; status: string }) => {
  const isPastDue = status === 'past_due';
  const cls = isPastDue
    ? 'DevBilling-planBadge DevBilling-planBadge--past_due'
    : `DevBilling-planBadge DevBilling-planBadge--${plan}`;
  const label = isPastDue ? 'Past due' : plan.charAt(0).toUpperCase() + plan.slice(1);
  return <span className={cls}>{label}</span>;
};

/**
 * Summary row above the plan grid: which tier is active, the period it covers,
 * and the way out to Stripe's customer portal.
 *
 * Only the paid tiers have a Stripe object behind them, so Free shows no period
 * and no portal link - there is nothing on the other end of it.
 */
const CurrentPlanRow = ({
  subscription,
  loading,
  openingPortal,
  onManageBilling,
}: {
  subscription: DeveloperSubscription | null;
  loading: boolean;
  openingPortal: boolean;
  onManageBilling: () => void;
}) => {
  if (loading) {
    return <p className="text-body-3 text-text-secondary">Loading subscription…</p>;
  }
  if (!subscription) return null;

  const isPro = subscription.plan === 'pro' || subscription.plan === 'enterprise';

  return (
    <div className="DevBilling-currentPlan">
      <PlanBadge plan={subscription.plan} status={subscription.status} />
      <span
        className="text-body-3 text-text-secondary DevBilling-planMeta"
        data-testid="billing-plan-meta"
      >
        {subscription.plan === 'free'
          ? 'You are on the Free plan.'
          : `Metered billing — ${formatPeriod(subscription.currentPeriodStart, subscription.currentPeriodEnd)}`}
        {subscription.cancelAtPeriodEnd && ' · Cancels at period end'}
      </span>
      {isPro && (
        <Secondary
          text={openingPortal ? 'Opening…' : 'Manage billing'}
          onClick={onManageBilling}
          style={{ maxWidth: 160, marginLeft: 'auto' }}
        />
      )}
    </div>
  );
};

export default CurrentPlanRow;
