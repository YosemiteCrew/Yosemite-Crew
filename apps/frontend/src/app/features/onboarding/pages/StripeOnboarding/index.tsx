'use client';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import { useStripeOnboarding, useSubscriptionCounterUpdate } from '@/app/hooks/useStripeOnboarding';
import {
  createConnectedAccount,
  onBoardConnectedAccount,
} from '@/app/features/billing/services/stripeService';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { loadConnectAndInitialize, StripeConnectInstance } from '@stripe/connect-js/pure';
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
  ConnectTaxRegistrations,
  ConnectTaxSettings,
} from '@stripe/react-connect-js';
import { useSubscriptionByOrgId } from '@/app/hooks/useBilling';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { IoArrowBack, IoLockClosed } from 'react-icons/io5';

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
  const subscriptionCounterUpdate = useSubscriptionCounterUpdate(orgIdFromQuery);

  const handleExit = useCallback(async () => {
    await subscriptionCounterUpdate.refetch();
    router.push('/dashboard');
  }, [subscriptionCounterUpdate, router]);

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
        await subscriptionCounterUpdate.refetch();
      }
    },
    [subscriptionCounterUpdate]
  );

  if (!onboard) {
    return null;
  }

  const canRetrySetup = Boolean(orgIdFromQuery) && !subscription?.connectAccountId;

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-6 md:py-10">
      <div className="flex w-full items-center justify-between gap-3">
        <Secondary
          text="Back"
          icon={<IoArrowBack aria-hidden="true" />}
          onClick={() => router.back()}
        />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--divider)] bg-[var(--screen)] px-3 py-1.5 text-caption-2 text-text-secondary">
          <IoLockClosed aria-hidden="true" className="text-[var(--success)]" />
          Secure · Powered by Stripe
        </span>
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-page-title text-text-primary">Stripe onboarding</h1>
        <p className="max-w-[460px] text-body-3 text-text-secondary">
          Complete your Stripe setup to accept card payments, verify tax details, and review payout
          information for your organization.
        </p>
      </div>

      {setupError && (
        <div
          className="w-full rounded-[18px] border border-[var(--hairline)] bg-[var(--screen)] px-5 py-4 text-center text-body-4 text-text-primary shadow-[0_2px_6px_var(--sh05),0_20px_55px_var(--sh10)]"
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
        <output
          className="w-full rounded-[18px] border border-[var(--hairline)] bg-[var(--screen)] px-5 py-4 text-center text-body-4 text-text-secondary shadow-[0_2px_6px_var(--sh05),0_20px_55px_var(--sh10)]"
          aria-live="polite"
          aria-busy={isPreparing}
        >
          Preparing your secure Stripe onboarding experience…
        </output>
      )}
      {connectInstance && (
        <div className="w-full rounded-[20px] border border-[var(--hairline)] bg-[var(--screen)] px-6 py-6 shadow-[0_2px_6px_var(--sh05),0_20px_55px_var(--sh10)]">
          <ConnectComponentsProvider connectInstance={connectInstance}>
            <div className="flex flex-col gap-5" aria-label="Stripe onboarding steps">
              <ConnectAccountOnboarding onExit={handleExit} onStepChange={handleStepChange} />
              <div className="flex flex-col gap-3">
                <h2 className="text-center text-heading-2 text-text-primary">
                  Tax business details
                </h2>
                <ConnectTaxSettings />
              </div>
              <div className="flex flex-col gap-3">
                <h2 className="text-center text-heading-2 text-text-primary">Tax registrations</h2>
                <ConnectTaxRegistrations />
              </div>
            </div>
          </ConnectComponentsProvider>
        </div>
      )}
    </div>
  );
};

const ProtectedStripeOnboarding = () => {
  return (
    <ProtectedRoute>
      <OrgGuard>
        <Suspense>
          <StripeOnboarding />
        </Suspense>
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedStripeOnboarding;
