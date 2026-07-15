'use client';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import { useStripeOnboarding, useSubscriptionCounterUpdate } from '@/app/hooks/useStripeOnboarding';
import {
  createConnectedAccount,
  onBoardConnectedAccount,
} from '@/app/features/billing/services/stripeService';
import { redirect, useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useCallback, useEffect, useReducer } from 'react';
import { loadConnectAndInitialize, StripeConnectInstance } from '@stripe/connect-js/pure';
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
  ConnectTaxRegistrations,
  ConnectTaxSettings,
} from '@stripe/react-connect-js';
import { useSubscriptionByOrgId } from '@/app/hooks/useBilling';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { IoArrowBack } from 'react-icons/io5';

type StripeSetupState = {
  accountId: string;
  connectInstance?: StripeConnectInstance;
  setupError: string | null;
  isPreparing: boolean;
};

type StripeSetupAction =
  | { type: 'prepare' }
  | { type: 'account-ready'; accountId: string }
  | { type: 'account-error'; message: string }
  | { type: 'connect-ready'; connectInstance: StripeConnectInstance }
  | { type: 'connect-error'; message: string };

const initialStripeSetupState: StripeSetupState = {
  accountId: '',
  connectInstance: undefined,
  setupError: null,
  isPreparing: true,
};

const stripeSetupReducer = (
  state: StripeSetupState,
  action: StripeSetupAction
): StripeSetupState => {
  switch (action.type) {
    case 'prepare':
      if (state.accountId) return state;
      if (state.setupError === null && state.isPreparing) return state;
      return { ...state, setupError: null, isPreparing: true };
    case 'account-ready':
      if (state.accountId === action.accountId && state.setupError === null) return state;
      return { ...state, accountId: action.accountId, setupError: null };
    case 'account-error':
      return { ...state, setupError: action.message, isPreparing: false };
    case 'connect-ready':
      return {
        ...state,
        connectInstance: action.connectInstance,
        setupError: null,
        isPreparing: false,
      };
    case 'connect-error':
      return { ...state, setupError: action.message, isPreparing: false };
    default:
      return state;
  }
};

const StripeOnboarding = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orgIdFromQuery = searchParams.get('orgId');
  const PUBLISHABE_KEY = process.env.NEXT_PUBLIC_SANDBOX_PUBLISH;
  const [setupState, dispatchSetup] = useReducer(stripeSetupReducer, initialStripeSetupState);
  const { accountId, connectInstance, setupError, isPreparing } = setupState;

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
      const account_id = await createConnectedAccount(orgIdFromQuery);
      if (!account_id) {
        router.push('/dashboard');
        return;
      }
      dispatchSetup({ type: 'account-ready', accountId: account_id });
    } catch (error) {
      console.error(error);
      dispatchSetup({
        type: 'account-error',
        message: 'We could not prepare Stripe onboarding. Please try again.',
      });
    }
  }, [orgIdFromQuery, router]);

  useEffect(() => {
    dispatchSetup({ type: 'prepare' });
    if (!subscription) return;
    if (subscription.connectAccountId) {
      dispatchSetup({ type: 'account-ready', accountId: subscription.connectAccountId });
      return;
    }
    createAccountIfNeeded();
  }, [subscription, createAccountIfNeeded]);

  useEffect(() => {
    if (!orgIdFromQuery || !accountId || !PUBLISHABE_KEY || !subscription) return;
    const fetchClientSecret = async () => {
      const secret = await onBoardConnectedAccount(orgIdFromQuery);
      return secret;
    };
    try {
      const instance = loadConnectAndInitialize({
        publishableKey: PUBLISHABE_KEY,
        fetchClientSecret,
        appearance: {
          overlays: 'drawer',
          variables: { colorPrimary: '#635BFF' },
        },
      });
      dispatchSetup({ type: 'connect-ready', connectInstance: instance });
    } catch (error) {
      console.error(error);
      dispatchSetup({
        type: 'connect-error',
        message:
          'We could not load the secure Stripe onboarding form. Please refresh the page and try again.',
      });
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

  if (!onboard || !orgIdFromQuery || !subscription || subscription.connectChargesEnabled) {
    redirect('/dashboard');
  }

  const canRetrySetup = Boolean(orgIdFromQuery) && !subscription?.connectAccountId;

  return (
    <div className="flex flex-col gap-6 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-5! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-5!">
      <div className="relative flex w-full items-center justify-center">
        <Secondary
          text="Back"
          icon={<IoArrowBack aria-hidden="true" />}
          onClick={() => router.back()}
          className="absolute left-0 top-1/2 -translate-y-1/2"
        />
        <h1 className="px-24 text-center text-heading-1 text-text-primary">Stripe Onboarding</h1>
      </div>
      <div className="mx-auto max-w-3xl text-center text-body-3 text-text-secondary">
        Complete your Stripe setup to accept card payments, verify tax details, and review
        payout-related information for your organisation.
      </div>
      {setupError && (
        <div
          className="mx-auto w-full max-w-3xl rounded-2xl border border-card-border bg-card-bg px-4 py-3 text-center text-body-4 text-text-primary"
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
          className="mx-auto w-full max-w-3xl rounded-2xl border border-card-border bg-card-bg px-4 py-3 text-center text-body-4 text-text-primary"
          aria-live="polite"
          aria-busy={isPreparing}
        >
          Preparing your secure Stripe onboarding experience…
        </output>
      )}
      {connectInstance && (
        <ConnectComponentsProvider connectInstance={connectInstance}>
          <div className="flex flex-col gap-5" aria-label="Stripe onboarding steps">
            <ConnectAccountOnboarding onExit={handleExit} onStepChange={handleStepChange} />
            <div className="flex flex-col gap-3">
              <h2 className="text-center text-heading-2 text-text-primary">Tax Business Details</h2>
              <ConnectTaxSettings />
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-center text-heading-2 text-text-primary">Tax Registrations</h2>
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
        <Suspense>
          <StripeOnboarding />
        </Suspense>
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedStripeOnboarding;
