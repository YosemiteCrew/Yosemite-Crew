"use client";
import OrgGuard from "@/app/components/OrgGuard";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { useStripeOnboarding } from "@/app/hooks/useStripeOnboarding";
import {
  checkStatus,
  createConnectedAccount,
  onBoardConnectedAccount,
} from "@/app/services/stripeService";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import {
  loadConnectAndInitialize,
  StripeConnectInstance,
} from "@stripe/connect-js";
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from "@stripe/react-connect-js";

const StripeOnboarding = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orgIdFromQuery = searchParams.get("orgId");
  const [accountId, setAccountId] = useState("");
  const PUBLISHABE_KEY = process.env.NEXT_PUBLIC_SANDBOX_PUBLISH;
  const [connectInstance, setConnectInstance] =
    useState<StripeConnectInstance>();

  const { onboard } = useStripeOnboarding(orgIdFromQuery);

  const createAccount = async () => {
    try {
      const status: any = await checkStatus(orgIdFromQuery);
      if (status?.chargesEnabled || status?.payoutsEnabled) {
        router.push("/dashboard");
        return;
      }
      const account_id = await createConnectedAccount(orgIdFromQuery);
      if (!account_id) {
        router.push("/dashboard");
        return;
      }
      setAccountId(account_id);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    if (accountId && PUBLISHABE_KEY && orgIdFromQuery) {
      const fetchClientSecret = async () => {
        const res = await onBoardConnectedAccount(orgIdFromQuery);
        return res;
      };
      setConnectInstance(
        loadConnectAndInitialize({
          publishableKey: PUBLISHABE_KEY,
          fetchClientSecret,
          appearance: {
            overlays: "dialog",
            variables: {
              colorPrimary: "#635BFF",
            },
          },
        })
      );
    }
  }, [accountId, orgIdFromQuery]);

  useEffect(() => {
    if (onboard) {
      createAccount();
    } else {
      router.push("/organizations");
    }
  }, [onboard]);

  if (!onboard) {
    return null;
  }

  return (
    <div className="flex flex-col gap-8 lg:gap-20 px-4! py-6! md:px-12! md:py-10! lg:px-10! lg:pb-20! lg:pr-20!">
      <div className="flex justify-between items-center w-full">
        <div className="font-grotesk font-medium text-black-text text-[33px]">
          Stripe Onboarding
        </div>
      </div>
      {connectInstance && (
        <ConnectComponentsProvider connectInstance={connectInstance}>
          <ConnectAccountOnboarding onExit={() => router.push("/dashboard")} />
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
