import { useCallback, useMemo, useState } from "react";
import { useOrgStore } from "@/app/stores/orgStore";
import { checkStatus } from "../services/stripeService";
import { PERMISSIONS } from "../utils/permissions";

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
    const hasPerm = membership.effectivePermissions?.includes(
      PERMISSIONS.ORG_EDIT,
    );
    const isOrgVerified = org.isVerified;

    if (!hasPerm || !isOrgVerified) {
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

  const refetch = useCallback(async () => {
    if (!finalOrgId) return;
    setLoading(true);
    setError(null);
    try {
      await checkStatus(finalOrgId);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [finalOrgId]);

  return {
    loading,
    error,
    refetch,
  };
};
