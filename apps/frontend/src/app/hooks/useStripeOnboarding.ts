import { useCallback, useMemo, useState } from "react";
import { useOrgStore } from "@/app/stores/orgStore";
import { checkStatus } from "../services/stripeService";
import { useSubscriptionStore } from "../stores/subscriptionStore";
import { useCounterStore } from "../stores/counterStore";

export const useStripeOnboarding = (
  orgId: string | null,
): {
  onboard: boolean;
} => {
  const org = useOrgStore((s) => (orgId ? (s.orgsById[orgId] ?? null) : null));
  const membership = useOrgStore((s) =>
    orgId ? (s.membershipsByOrgId[orgId] ?? null) : null,
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

export const useSubscriptionCounterUpdate = (
  orgId?: string | null,
): UseStripeAccountStatusResult => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  const finalOrgId = orgId || primaryOrgId || "";

  const setSubscriptionForOrg = useSubscriptionStore(
    (s) => s.setSubscriptionForOrg,
  );

  const setCounterForOrg = useCounterStore((s) => s.setCounterForOrg);

  const refetch = useCallback(async () => {
    if (!finalOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await checkStatus(finalOrgId);
      setSubscriptionForOrg(finalOrgId, data.orgBilling);
      setCounterForOrg(finalOrgId, data.orgUsage);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [finalOrgId, setSubscriptionForOrg]);

  return {
    loading,
    error,
    refetch,
  };
};
