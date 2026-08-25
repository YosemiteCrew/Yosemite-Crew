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

const DeveloperBilling = () => {
  const [subscription, setSubscription] = useState<DeveloperSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

  const loadSubscription = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSubscription(await getSubscription());
    } catch (err) {
      logger.error('Failed to load developer subscription', err);
      setError('Could not load your subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSubscription();
  }, [loadSubscription]);

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

        {error && <p className="DevBilling-error">{error}</p>}

        <div className="DevBilling-plans">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.key;

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
                    text={
                      isCurrent ? 'Current plan' : checkingOut ? 'Redirecting…' : 'Upgrade to Pro'
                    }
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
