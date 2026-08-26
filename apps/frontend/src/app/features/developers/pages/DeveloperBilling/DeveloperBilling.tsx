'use client';
import React, { useCallback, useEffect, useState } from 'react';

import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';
import { logger } from '@/app/lib/logger';
import {
  createCheckoutSession,
  createPortalSession,
  getSubscription,
  type DeveloperPlanTier,
  type DeveloperSubscription,
} from '@/app/services/developerBilling';
import { getUsage, type DeveloperUsage } from '@/app/services/developerUsage';

import './DeveloperBilling.css';
import '@/app/features/organizations/styles/Organizations.css';

const PLANS: {
  key: DeveloperPlanTier;
  name: string;
  price: string;
  priceSub: string;
  description: string;
  features: string[];
  recommended: boolean;
}[] = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    priceSub: 'forever',
    description: 'Explore the API and build your first integration.',
    features: [
      '1,000 API calls / month',
      '1 API key',
      'Test environment access',
      'Community support',
    ],
    recommended: false,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 'Pay as you go',
    priceSub: 'metered · billed monthly',
    description: 'Scales with your usage — pay only for what you consume.',
    features: [
      '~$0.002 per API call',
      'First 1,000 calls free each month',
      'Unlimited API keys',
      'Live + test environments',
      'Webhook support',
      'Priority support',
    ],
    recommended: true,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    priceSub: 'volume discounts available',
    description: 'For platforms and large teams with predictable high-volume needs.',
    features: [
      'Custom per-call rate',
      'Unlimited API keys',
      'Dedicated support',
      'Custom SLA',
      'Usage analytics dashboard',
    ],
    recommended: false,
  },
];

const formatPeriod = (start: string | null, end: string | null): string => {
  if (!start || !end) return '';
  const s = new Date(start).toLocaleDateString();
  const e = new Date(end).toLocaleDateString();
  return `${s} – ${e}`;
};

const PlanBadge = ({ plan, status }: { plan: DeveloperPlanTier; status: string }) => {
  const isPastDue = status === 'past_due';
  const cls = isPastDue
    ? 'DevBilling-planBadge DevBilling-planBadge--past_due'
    : `DevBilling-planBadge DevBilling-planBadge--${plan}`;
  const label = isPastDue ? 'Past due' : plan.charAt(0).toUpperCase() + plan.slice(1);
  return <span className={cls}>{label}</span>;
};

/**
 * Calls consumed in the current billing period.
 *
 * Deliberately renders only what the API returns. A plan with an included
 * allowance reports `limit`, and the meter fills against it; a metered plan
 * reports `limit: null`, and the count is shown bare. The "first 1,000 calls
 * free" the Pro card advertises is a tier on the Stripe price, not a number this
 * app owns, so it is never recomputed here into a billable-calls figure that
 * could disagree with the invoice.
 */
const UsageMeter = ({ usage }: { usage: DeveloperUsage }) => {
  const { billingPeriod, callCount, limit } = usage;
  const formatted = callCount.toLocaleString();

  /* A limit is only usable as a denominator when it is positive. `limit: 0`
     would make the fill `0 / 0` -> NaN, which reaches the DOM as the invalid
     `width: NaN%`. Anything non-positive is treated as "no allowance to show",
     the same as the null the metered plans send. */
  const allowance = limit !== null && limit > 0 ? limit : null;
  const exhausted = allowance !== null && callCount >= allowance;

  return (
    <div className="DevBilling-usage" data-testid="billing-usage">
      <div className="DevBilling-usageHead">
        <span className="DevBilling-usageLabel">API calls this period</span>
        <span className="DevBilling-usagePeriod">{billingPeriod}</span>
      </div>

      <p className="DevBilling-usageCount">
        {formatted}
        {allowance !== null && (
          <span className="DevBilling-usageLimit"> / {allowance.toLocaleString()}</span>
        )}
      </p>

      {allowance !== null && (
        <div
          className="DevBilling-usageTrack"
          role="progressbar"
          aria-valuenow={Math.min(callCount, allowance)}
          aria-valuemin={0}
          aria-valuemax={allowance}
          aria-label="Included API calls used this period"
        >
          <div
            className={`DevBilling-usageFill${exhausted ? ' DevBilling-usageFill--exhausted' : ''}`}
            style={{ width: `${Math.min(100, (callCount / allowance) * 100)}%` }}
          />
        </div>
      )}

      {exhausted && (
        <p className="DevBilling-usageWarning" role="alert">
          You have used your monthly allowance. Further API calls return 429 until the period resets
          — upgrade to Pro to keep going.
        </p>
      )}

      {allowance === null && (
        <p className="DevBilling-usageNote">
          Metered — billed at the end of the period. Test-environment calls are not counted.
        </p>
      )}
    </div>
  );
};

const DeveloperBilling = () => {
  const [subscription, setSubscription] = useState<DeveloperSubscription | null>(null);
  const [usage, setUsage] = useState<DeveloperUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

  const loadBilling = useCallback(async () => {
    // No setLoading(true) here: this runs from the mount effect and `loading`
    // already starts true, so setting it again would be a synchronous state
    // write during the effect body.
    //
    // allSettled rather than all: usage is supplementary, and a failing usage
    // request must not take the plan cards down with it.
    const [subResult, usageResult] = await Promise.allSettled([getSubscription(), getUsage()]);

    if (subResult.status === 'fulfilled') {
      setSubscription(subResult.value);
      setError(null);
    } else {
      logger.error('Failed to load developer subscription', subResult.reason);
      setError('Could not load your subscription. Please try again.');
    }

    if (usageResult.status === 'fulfilled') {
      setUsage(usageResult.value);
    } else {
      logger.error('Failed to load developer API usage', usageResult.reason);
      setUsage(null);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    // Wrapped rather than called directly: the hooks lint cannot see through the
    // useCallback to prove the setStates all happen after an await, and flags a
    // bare `loadBilling()` as a synchronous state write.
    const run = async () => {
      await loadBilling();
    };
    run();
  }, [loadBilling]);

  const handleUpgrade = async () => {
    if (checkingOut) return;
    setCheckingOut(true);
    setError(null);
    try {
      const successUrl = `${window.location.origin}/developers/billing?upgraded=1`;
      const cancelUrl = `${window.location.origin}/developers/billing`;
      const url = await createCheckoutSession({ successUrl, cancelUrl });
      window.location.href = url;
    } catch (err) {
      logger.error('Failed to create checkout session', err);
      setError('Could not start the upgrade flow. Please try again.');
      setCheckingOut(false);
    }
  };

  const handleManageBilling = async () => {
    if (openingPortal) return;
    setOpeningPortal(true);
    setError(null);
    try {
      const returnUrl = `${window.location.origin}/developers/billing`;
      const url = await createPortalSession(returnUrl);
      window.location.href = url;
    } catch (err) {
      logger.error('Failed to open billing portal', err);
      setError('Could not open the billing portal. Please try again.');
      setOpeningPortal(false);
    }
  };

  const currentPlan = subscription?.plan ?? 'free';
  const isPro = currentPlan === 'pro' || currentPlan === 'enterprise';

  const renderCurrentPlan = () => {
    if (loading) {
      return <p className="text-body-3 text-text-secondary">Loading subscription…</p>;
    }
    if (!subscription) return null;
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
            onClick={handleManageBilling}
            style={{ maxWidth: 160, marginLeft: 'auto' }}
          />
        )}
      </div>
    );
  };

  return (
    <DevRouteGuard>
      <div className="OperationsWrapper">
        <div className="TitleContainer">
          <h1 className="text-heading-1 text-text-primary">Billing</h1>
        </div>

        <p className="text-body-3 text-text-secondary DevBilling-intro">
          API usage is billed at the end of each calendar month based on the number of requests made
          with your live API keys. Test-environment calls are always free.
        </p>

        {renderCurrentPlan()}

        {!loading && usage && <UsageMeter usage={usage} />}

        {error && <p className="DevBilling-error">{error}</p>}

        <div className="DevBilling-plans">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.key;

            /* Extracted rather than nested inline in the Pro button: a nested
               ternary trips Sonar's typescript:S3358, and the three states read
               more clearly named than stacked. */
            let proLabel = 'Upgrade to Pro';
            if (isCurrent) {
              proLabel = 'Current plan';
            } else if (checkingOut) {
              proLabel = 'Redirecting…';
            }

            return (
              <div
                key={plan.key}
                className={[
                  'DevBilling-planCard',
                  isCurrent ? 'DevBilling-planCard--current' : '',
                  plan.recommended && !isCurrent ? 'DevBilling-planCard--recommended' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-testid={`plan-card-${plan.key}`}
              >
                <p className="DevBilling-planName">{plan.name}</p>
                <p className="DevBilling-planPrice">{plan.price}</p>
                <p className="DevBilling-planPriceSub">{plan.priceSub}</p>
                <p className="DevBilling-planDesc">{plan.description}</p>

                <ul className="DevBilling-planFeatures">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>

                {plan.key === 'free' && (
                  <Secondary
                    text={isCurrent ? 'Current plan' : 'Downgrade'}
                    isDisabled
                    style={{ maxWidth: '100%' }}
                  />
                )}
                {plan.key === 'pro' && (
                  <Primary
                    text={proLabel}
                    onClick={isCurrent ? undefined : handleUpgrade}
                    isDisabled={isCurrent || checkingOut}
                    style={{ maxWidth: '100%' }}
                  />
                )}
                {plan.key === 'enterprise' && (
                  <Secondary
                    text={isCurrent ? 'Current plan' : 'Contact us'}
                    onClick={
                      isCurrent
                        ? undefined
                        : () => {
                            window.location.href = 'mailto:enterprise@yosemitecrew.com';
                          }
                    }
                    isDisabled={isCurrent}
                    style={{ maxWidth: '100%' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </DevRouteGuard>
  );
};

export default DeveloperBilling;
