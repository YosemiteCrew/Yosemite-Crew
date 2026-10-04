import { useReducer } from 'react';
import { useOrgStore } from '@/app/stores/orgStore';
import { useIntegrationsForPrimaryOrg } from '@/app/hooks/useIntegrations';
import { getMerckGateway } from '@/app/features/integrations/services/merckService';
import { OrgIntegration } from '@/app/features/integrations/services/types';

const resolveIntegration = (
  primaryOrgId: string | null,
  integrations: OrgIntegration[]
): OrgIntegration | null => {
  if (!primaryOrgId) return null;
  try {
    return getMerckGateway().getStatus(primaryOrgId, integrations);
  } catch {
    return null;
  }
};

export const useResolvedMerckIntegrationForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const integrations = useIntegrationsForPrimaryOrg();
  const [, refresh] = useReducer((tick: number) => tick + 1, 0);
  const resolvedIntegration = resolveIntegration(primaryOrgId, integrations);
  const isEnabled = (resolvedIntegration?.status ?? 'disabled').toLowerCase() === 'enabled';

  return {
    primaryOrgId,
    integration: resolvedIntegration,
    isEnabled,
    refresh,
  };
};
