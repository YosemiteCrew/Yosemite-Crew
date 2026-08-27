'use client';
import React from 'react';

import { Secondary } from '@/app/ui/primitives/Buttons';
import type { DeveloperPlanTier, DeveloperSubscription } from '@/app/services/developerBilling';

const formatPeriod = (start: string | null, end: string | null): string => {
  if (!start || !end) return '';
  const s = new Date(start).toLocaleDateString();
  const e = new Date(end).toLocaleDateString();
  return `${s} – ${e}`;
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
