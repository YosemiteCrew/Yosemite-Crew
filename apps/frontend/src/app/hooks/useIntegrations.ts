import { useEffect, useMemo } from 'react';
import { useOrgStore } from '@/app/stores/orgStore';
import { useIntegrationStore } from '@/app/stores/integrationStore';
import {
  getApiErrorMessage,
  getOrgIntegrations,
} from '@/app/features/integrations/services/idexxService';
import { IntegrationProvider, OrgIntegration } from '@/app/features/integrations/services/types';

export const loadIntegrationsForPrimaryOrg = async (opts?: {
  force?: boolean;
  silent?: boolean;
}) => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  const {
    status,
    startLoading,
    setError,
    setIntegrationsForOrg,
    lastFetchedAt,
    integrationIdsByOrgId,
  } = useIntegrationStore.getState();

  if (!primaryOrgId) return;
  const hasOrgData = Object.hasOwn(integrationIdsByOrgId, primaryOrgId);
  const shouldFetch =
    opts?.force || status === 'idle' || status === 'error' || !lastFetchedAt || !hasOrgData;
  if (!shouldFetch) return;

  if (!opts?.silent) startLoading();
  try {
    const integrations = await getOrgIntegrations(primaryOrgId);
    setIntegrationsForOrg(primaryOrgId, integrations);
  } catch (error) {
    const message = getApiErrorMessage(error, 'Unable to load integrations at the moment.');
    setError(message);
    throw error;
  }
};

export const useLoadIntegrationsForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const integrationIdsByOrgId = useIntegrationStore((s) => s.integrationIdsByOrgId);
  const status = useIntegrationStore((s) => s.status);
  useEffect(() => {
    if (!primaryOrgId) return;
    if (status === 'loading') return;
    if (Object.hasOwn(integrationIdsByOrgId, primaryOrgId)) return;
    void loadIntegrationsForPrimaryOrg();
  }, [primaryOrgId, integrationIdsByOrgId, status]);
};

export const useIntegrationsForPrimaryOrg = (): OrgIntegration[] => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const integrationsById = useIntegrationStore((s) => s.integrationsById);
  const integrationIdsByOrgId = useIntegrationStore((s) => s.integrationIdsByOrgId);

  return useMemo(() => {
    if (!primaryOrgId) return [];
    const ids = integrationIdsByOrgId[primaryOrgId] ?? [];
    return ids
      .map((id) => integrationsById[id])
      .filter((item): item is OrgIntegration => item != null);
  }, [primaryOrgId, integrationIdsByOrgId, integrationsById]);
};

export const useIntegrationByProviderForPrimaryOrg = (
  provider: IntegrationProvider
): OrgIntegration | null => {
  const integrations = useIntegrationsForPrimaryOrg();
  const normalizedProvider = provider.toLowerCase();
  return (
    integrations.find(
      (integration) => String(integration.provider ?? '').toLowerCase() === normalizedProvider
    ) ?? null
  );
};
