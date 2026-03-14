import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOrgStore } from '@/app/stores/orgStore';
import { useIntegrationsForPrimaryOrg } from '@/app/hooks/useIntegrations';
import { getMerckGateway } from '@/app/features/integrations/services/merckService';
import { OrgIntegration } from '@/app/features/integrations/services/types';

export const useResolvedMerckIntegrationForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const integrations = useIntegrationsForPrimaryOrg();
  const [resolvedIntegration, setResolvedIntegration] = useState<OrgIntegration | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!primaryOrgId) {
        if (mounted) setResolvedIntegration(null);
        return;
      }
      const gateway = getMerckGateway();
      const status = await gateway.getStatus(primaryOrgId, integrations);
      if (mounted) setResolvedIntegration(status);
    };

    run().catch(() => {
      if (!mounted) return;
      setResolvedIntegration(null);
    });

    return () => {
      mounted = false;
    };
  }, [primaryOrgId, integrations, refreshTick]);

  const isEnabled = useMemo(
    () => (resolvedIntegration?.status ?? 'disabled').toLowerCase() === 'enabled',
    [resolvedIntegration?.status]
  );

  const refresh = useCallback(() => {
    setRefreshTick((prev) => prev + 1);
  }, []);

  return {
    primaryOrgId,
    integration: resolvedIntegration,
    isEnabled,
    refresh,
  };
};
