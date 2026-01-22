import { useCallback, useMemo, useState } from "react";
import { useOrgStore } from "@/app/stores/orgStore";
import { checkStatus } from "../services/stripeService";
import { useSubscriptionStore } from "../stores/subscriptionStore";
import { BillingSubscription } from "../types/billing";

export const useStripeOnboarding = (
  orgId: string | null
): {
  onboard: boolean;
} => {
  const org = useOrgStore((s) => (orgId ? (s.orgsById[orgId] ?? null) : null));
  const membership = useOrgStore((s) =>
    orgId ? (s.membershipsByOrgId[orgId] ?? null) : null
  );

  const { onboard } = useMemo(() => {
    if (!orgId || !org || !membership) {
      return { onboard: false };
    }
    const role = (
      membership.roleDisplay ??
      membership.roleCode ??
      ""
    ).toLowerCase();
    const isOwner = role === "owner";

    const isOrgVerified = org.isVerified;

    if (!isOwner || !isOrgVerified) {
      return { onboard: false };
    }

    return {
      onboard: true,
    };
  }, [orgId, org, membership]);

  return {
    onboard: onboard,
  };
};

type UseStripeAccountStatusResult = {
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

export const useStripeAccountStatus = (
  orgId: string | null
): UseStripeAccountStatusResult => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const setSubscriptionForOrg = useSubscriptionStore(
    (s) => s.setSubscriptionForOrg
  );

  const refetch = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await checkStatus(orgId);
      setSubscriptionForOrg(orgId, data as BillingSubscription);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [orgId, setSubscriptionForOrg]);

  return {
    loading,
    error,
    refetch,
  };
};
