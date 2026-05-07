'use client';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import { useStripeOnboarding, useSubscriptionCounterUpdate } from '@/app/hooks/useStripeOnboarding';
import {
  createConnectedAccount,
  onBoardConnectedAccount,
} from '@/app/features/billing/services/stripeService';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import { loadConnectAndInitialize, StripeConnectInstance } from '@stripe/connect-js/pure';
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
  ConnectTaxRegistrations,
  ConnectTaxSettings,
} from '@stripe/react-connect-js';
import { useSubscriptionByOrgId } from '@/app/hooks/useBilling';
import { Secondary } from '@/app/ui/primitives/Buttons';

const StripeOnboarding = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orgIdFromQuery = searchParams.get('orgId');
  const [accountId, setAccountId] = useState('');
  const PUBLISHABE_KEY = process.env.NEXT_PUBLIC_SANDBOX_PUBLISH;
  const [connectInstance, setConnectInstance] = useState<StripeConnectInstance>();
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(true);

  const { onboard } = useStripeOnboarding(orgIdFromQuery);
  const subscription = useSubscriptionByOrgId(orgIdFromQuery);
  const { refetch: refetchData } = useSubscriptionCounterUpdate(orgIdFromQuery);

  const handleExit = useCallback(async () => {
    await refetchData();
    router.push('/dashboard');
  }, [refetchData, router]);

  const createAccountIfNeeded = useCallback(async () => {
    if (!orgIdFromQuery) return;
    try {
      setSetupError(null);
      const account_id = await createConnectedAccount(orgIdFromQuery);
      if (!account_id) {
        router.push('/dashboard');
        return;
      }
      setAccountId(account_id);
    } catch (error) {
      console.error(error);
      setSetupError('We could not prepare Stripe onboarding. Please try again.');
      setIsPreparing(false);
    }
  }, [orgIdFromQuery, router]);

  useEffect(() => {
    setIsPreparing(true);
    if (!onboard) {
      router.push('/dashboard');
      return;
    }
    if (!orgIdFromQuery) {
      router.push('/dashboard');
      return;
    }
    if (!subscription) {
      router.push('/dashboard');
      return;
    }
    if (subscription.connectChargesEnabled) {
      router.push('/dashboard');
      return;
    }
    if (subscription.connectAccountId) {
      setAccountId(subscription.connectAccountId);
      setSetupError(null);
      return;
    }
    createAccountIfNeeded();
  }, [onboard, orgIdFromQuery, subscription, createAccountIfNeeded, router]);

  useEffect(() => {
    if (!orgIdFromQuery || !accountId || !PUBLISHABE_KEY || !subscription) return;
    const fetchClientSecret = async () => {
      const secret = await onBoardConnectedAccount(orgIdFromQuery);
      return secret;
    };
    try {
      setSetupError(null);
      const instance = loadConnectAndInitialize({
        publishableKey: PUBLISHABE_KEY,
        fetchClientSecret,
        appearance: {
          overlays: 'drawer',
          variables: { colorPrimary: '#635BFF' },
        },
      });
      setConnectInstance(instance);
      setIsPreparing(false);
    } catch (error) {
      console.error(error);
      setSetupError(
        'We could not load the secure Stripe onboarding form. Please refresh the page and try again.'
      );
      setIsPreparing(false);
    }
  }, [orgIdFromQuery, accountId, PUBLISHABE_KEY, subscription]);

  const handleStepChange = useCallback(
    async ({ step }: { step: string }) => {
      if (step === 'stripe_user_authentication') {
        await refetchData();
      }
    },
    [refetchData]
  );

  if (!onboard) {
    return null;
  }

  const canRetrySetup = Boolean(orgIdFromQuery) && !subscription?.connectAccountId;

  return (
    <div className="flex flex-col gap-6 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-5! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-5!">
      <div className="flex justify-between items-center w-full">
        <h1 className="text-text-primary text-heading-1">Stripe Onboarding</h1>
      </div>
      <div className="max-w-3xl text-body-3 text-text-secondary">
        Complete your Stripe setup to accept card payments, verify tax details, and review
        payout-related information for your organisation.
      </div>
      {setupError && (
        <div
          className="max-w-3xl rounded-2xl border border-card-border bg-card-bg px-4 py-3 text-body-4 text-text-primary"
          role="alert"
        >
          <div>{setupError}</div>
          {canRetrySetup ? (
            <div className="mt-3">
              <Secondary text="Try again" onClick={() => createAccountIfNeeded()} />
            </div>
          ) : null}
        </div>
      )}
      {!setupError && !connectInstance && (
        <div
          className="max-w-3xl rounded-2xl border border-card-border bg-card-bg px-4 py-3 text-body-4 text-text-primary"
          role="status"
          aria-live="polite"
          aria-busy={isPreparing}
        >
          Preparing your secure Stripe onboarding experience…
        </div>
      )}
      {connectInstance && (
        <ConnectComponentsProvider connectInstance={connectInstance}>
          <div className="flex flex-col gap-5" aria-label="Stripe onboarding steps">
            <ConnectAccountOnboarding onExit={handleExit} onStepChange={handleStepChange} />
            <div>
              <h2 className="text-text-primary text-heading-1">Tax Business Details</h2>
              <ConnectTaxSettings />
            </div>
            <div style={{ marginTop: '12px' }}>
              <h2 className="text-text-primary text-heading-1">Tax Registrations</h2>
              <ConnectTaxRegistrations />
            </div>
          </div>
        </ConnectComponentsProvider>
      )}
    </div>
  );
};

const ProtectedStripeOnboarding = () => {
  return (
    <ProtectedRoute>
      <OrgGuard>
        <StripeOnboarding />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedStripeOnboarding;
