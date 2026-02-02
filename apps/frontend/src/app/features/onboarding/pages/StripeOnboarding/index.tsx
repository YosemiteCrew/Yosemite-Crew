"use client";
import OrgGuard from "@/app/ui/layout/guards/OrgGuard";
import ProtectedRoute from "@/app/ui/layout/guards/ProtectedRoute";
import {
  useStripeOnboarding,
  useSubscriptionCounterUpdate,
} from "@/app/hooks/useStripeOnboarding";
import {
  createConnectedAccount,
  onBoardConnectedAccount,
} from "@/app/features/billing/services/stripeService";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import {
  loadConnectAndInitialize,
  StripeConnectInstance,
} from "@stripe/connect-js";
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
  ConnectTaxRegistrations,
  ConnectTaxSettings,
} from "@stripe/react-connect-js";
import { useSubscriptionByOrgId } from "@/app/hooks/useBilling";

const StripeOnboarding = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orgIdFromQuery = searchParams.get("orgId");
  const [accountId, setAccountId] = useState("");
  const PUBLISHABE_KEY = process.env.NEXT_PUBLIC_SANDBOX_PUBLISH;
  const [connectInstance, setConnectInstance] =
    useState<StripeConnectInstance>();

  const { onboard } = useStripeOnboarding(orgIdFromQuery);
  const subscription = useSubscriptionByOrgId(orgIdFromQuery);
  const { refetch: refetchData } = useSubscriptionCounterUpdate(orgIdFromQuery);

  const handleExit = useCallback(async () => {
    await refetchData();
    router.push("/dashboard");
  }, [refetchData, router]);

  const createAccountIfNeeded = useCallback(async () => {
    if (!orgIdFromQuery) return;
    try {
      const account_id = await createConnectedAccount(orgIdFromQuery);
      if (!account_id) {
        router.push("/dashboard");
        return;
      }
      setAccountId(account_id);
    } catch (error) {
      console.log(error);
    }
  }, [orgIdFromQuery, router]);

  useEffect(() => {
    if (!onboard) {
      router.push("/dashboard");
      return;
    }
    if (!orgIdFromQuery) {
      router.push("/dashboard");
      return;
    }
    if (!subscription) {
      router.push("/dashboard");
      return;
    }
    if (subscription.connectChargesEnabled) {
      router.push("/dashboard");
      return;
    }
    if (subscription.connectAccountId) {
      setAccountId(subscription.connectAccountId);
      return;
    }
    createAccountIfNeeded();
  }, [onboard, orgIdFromQuery, subscription, createAccountIfNeeded, router]);

  useEffect(() => {
    if (!orgIdFromQuery || !accountId || !PUBLISHABE_KEY || !subscription)
      return;
    const fetchClientSecret = async () => {
      const secret = await onBoardConnectedAccount(orgIdFromQuery);
      return secret;
    };
    try {
      const instance = loadConnectAndInitialize({
        publishableKey: PUBLISHABE_KEY,
        fetchClientSecret,
        appearance: {
          overlays: "dialog",
          variables: { colorPrimary: "#635BFF" },
        },
      });
      setConnectInstance(instance);
    } catch (e: any) {
      console.error(e);
    }
  }, [orgIdFromQuery, accountId, PUBLISHABE_KEY, subscription]);

  const handleStepChange = useCallback(async ({ step }: { step: string }) => {
    if (step === "stripe_user_authentication") {
      await refetchData();
    }
  }, [refetchData]);

  if (!onboard) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6 px-3! py-3! sm:px-12! lg:px-[60px]! sm:py-12!">
      <div className="flex justify-between items-center w-full">
        <div className="text-text-primary text-heading-1">
          Stripe Onboarding
        </div>
      </div>
      {connectInstance && (
        <ConnectComponentsProvider connectInstance={connectInstance}>
          <div>
            <ConnectAccountOnboarding
              onExit={handleExit}
              onStepChange={handleStepChange}
            />
            <div>
              <h2>Tax Business Details</h2>
              <ConnectTaxSettings />
            </div>
            <div style={{ marginTop: "12px" }}>
              <h2>Tax Registrations</h2>
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
