import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrgStore } from "@/app/stores/orgStore";
import { checkStatus } from "../services/stripeService";

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

export const useStripeAccountStatus = (orgId: string | null) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!orgId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await checkStatus(orgId);
      setStatus(data as any);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    loading,
    error
  };
};
