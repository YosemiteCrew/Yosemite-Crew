'use client';
import React, { useCallback, useEffect, useState } from 'react';

import DevRouteGuard from '@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard';
import { logger } from '@/app/lib/logger';
import {
  createCheckoutSession,
  createPortalSession,
  getSubscription,
  type DeveloperSubscription,
} from '@/app/services/developerBilling';
import { getUsage, type DeveloperUsage } from '@/app/services/developerUsage';

import CurrentPlanRow from './CurrentPlanRow';
import PlanCard from './PlanCard';
import UsageMeter from './UsageMeter';
import { PLANS } from './plans';

import './DeveloperBilling.css';
import '@/app/features/organizations/styles/Organizations.css';

/**
 * Owns the two reads and the two Stripe hand-offs; the summary row, the usage
 * meter and the plan cards are separate components. What is left here is the
 * server-backed state and the redirect flows.
 */
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

  // Both hand-offs clear their pending flag only on failure: on success the
  // browser is already navigating to Stripe, and resetting it would flash the
  // idle label over a page that is on its way out.
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

        <CurrentPlanRow
          subscription={subscription}
          loading={loading}
          openingPortal={openingPortal}
          onManageBilling={handleManageBilling}
        />

        {!loading && usage && <UsageMeter usage={usage} />}

        {error && <p className="DevBilling-error">{error}</p>}

        <div className="DevBilling-plans">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              isCurrent={currentPlan === plan.key}
              checkingOut={checkingOut}
              onUpgrade={handleUpgrade}
            />
          ))}
        </div>
      </div>
    </DevRouteGuard>
  );
};

export default DeveloperBilling;
