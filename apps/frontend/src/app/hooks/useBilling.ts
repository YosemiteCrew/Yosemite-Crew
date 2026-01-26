import { useEffect, useMemo } from "react";
import { useOrgStore } from "../stores/orgStore";
import { useCounterStore } from "../stores/counterStore";
import {
  BillingCounter,
  BillingSubscription,
  CanResult,
  FreeMetric,
} from "../types/billing";
import { useSubscriptionStore } from "../stores/subscriptionStore";
import { checkStatus } from "../services/stripeService";

export const useLoadSubscriptionCounterForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  useEffect(() => {
    if (!primaryOrgId) return;
    void checkStatus(primaryOrgId);
  }, [primaryOrgId]);
};

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
    (s) => s.subscriptionByOrgId,
  );

  return useMemo(() => {
    if (!primaryOrgId) return null;
    return subscriptionByOrgId[primaryOrgId] ?? null;
  }, [primaryOrgId, subscriptionByOrgId]);
};

export const useSubscriptionByOrgId = (
  orgId: string | null,
): BillingSubscription | null => {
  const subscriptionByOrgId = useSubscriptionStore(
    (s) => s.subscriptionByOrgId,
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

const getMetricValues = (
  counter: BillingCounter,
  metric: FreeMetric,
): { freeLimit: number | null; used: number | null } => {
  if (metric === "appointments") {
    return {
      freeLimit:
        typeof counter.freeAppointmentsLimit === "number"
          ? counter.freeAppointmentsLimit
          : null,
      used:
        typeof counter.appointmentsUsed === "number"
          ? counter.appointmentsUsed
          : null,
    };
  }
  return {
    freeLimit:
      typeof counter.freeUsersLimit === "number"
        ? counter.freeUsersLimit
        : null,
    used:
      typeof counter.usersBillableCount === "number"
        ? counter.usersBillableCount
        : null,
  };
};

export const useCanMoreForPrimaryOrg = (metric: FreeMetric): CanResult => {
  const { counter, subscription } = useBillingForPrimaryOrg();

  return useMemo((): CanResult => {
    if (!subscription) {
      return {
        canMore: false,
        remainingFree: null,
        freeLimit: null,
        used: null,
        reason: "no_subscription",
      };
    }
    if (subscription.plan !== "free") {
      return {
        canMore: true,
        remainingFree: null,
        freeLimit: null,
        used: null,
        reason: "not_free_plan",
      };
    }
    if (!counter) {
      return {
        canMore: false,
        remainingFree: null,
        freeLimit: null,
        used: null,
        reason: "no_counter",
      };
    }
    const { freeLimit, used } = getMetricValues(counter, metric);
    if (freeLimit === null) {
      return {
        canMore: false,
        remainingFree: null,
        freeLimit: null,
        used,
        reason: "unknown_limit",
      };
    }
    if (used === null) {
      return {
        canMore: false,
        remainingFree: null,
        freeLimit,
        used: null,
        reason: "unknown_usage",
      };
    }
    const remaining = Math.max(0, freeLimit - used);
    const canMore = remaining > 0;
    return {
      canMore,
      remainingFree: remaining,
      freeLimit,
      used,
      reason: canMore ? "ok" : "limit_reached",
    };
  }, [counter, subscription, metric]);
};

export const useIsStripeActive = () => {
  const { subscription } = useBillingForPrimaryOrg();

  return useMemo(() => {
    if (!subscription) {
      return false;
    }
    return subscription.canAcceptPayments;
  }, [subscription]);
};
