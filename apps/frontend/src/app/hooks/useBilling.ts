import { useMemo } from "react";
import { useOrgStore } from "../stores/orgStore";
import { useCounterStore } from "../stores/counterStore";
import { BillingCounter, BillingSubscription } from "../types/billing";
import { useSubscriptionStore } from "../stores/subscriptionStore";

export const useCounterForPrimaryOrg = (): BillingCounter | null => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const countersByOrgId = useCounterStore((s) => s.countersByOrgId);

  return useMemo(() => {
    if (!primaryOrgId) return null;
    return countersByOrgId[primaryOrgId] ?? null;
  }, [primaryOrgId, countersByOrgId]);
};

export const useSubscriptionForPrimaryOrg = (): BillingSubscription | null => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const subscriptionByOrgId = useSubscriptionStore(
    (s) => s.subscriptionByOrgId
  );

  return useMemo(() => {
    if (!primaryOrgId) return null;
    return subscriptionByOrgId[primaryOrgId] ?? null;
  }, [primaryOrgId, subscriptionByOrgId]);
};

export const useSubscriptionByOrgId = (
  orgId: string | null
): BillingSubscription | null => {
  const subscriptionByOrgId = useSubscriptionStore(
    (s) => s.subscriptionByOrgId
  );

  return useMemo(() => {
    if (!orgId) return null;
    return subscriptionByOrgId[orgId] ?? null;
  }, [orgId, subscriptionByOrgId]);
};

export const useBillingForPrimaryOrg = (): {
  counter: BillingCounter | null;
  subscription: BillingSubscription | null;
} => {
  const counter = useCounterForPrimaryOrg();
  const subscription = useSubscriptionForPrimaryOrg();

  return useMemo(() => ({ counter, subscription }), [counter, subscription]);
};
