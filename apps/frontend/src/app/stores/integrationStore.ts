import { create } from 'zustand';
import { IntegrationProvider, OrgIntegration } from '@/app/features/integrations/services/types';

type IntegrationStoreStatus = 'idle' | 'loading' | 'loaded' | 'error';

type IntegrationState = {
  integrationIdsByOrgId: Record<string, string[]>;
  integrationsById: Record<string, OrgIntegration>;
  status: IntegrationStoreStatus;
  error: string | null;
  lastFetchedAt: string | null;
  setIntegrationsForOrg: (orgId: string, integrations: OrgIntegration[]) => void;
  upsertIntegration: (integration: OrgIntegration) => void;
  getIntegrationsByOrgId: (orgId: string) => OrgIntegration[];
  getIntegrationByProvider: (orgId: string, provider: IntegrationProvider) => OrgIntegration | null;
  clearIntegrationsForOrg: (orgId: string) => void;
  clearIntegrations: () => void;
  startLoading: () => void;
  endLoading: () => void;
  setError: (message: string) => void;
};

export const useIntegrationStore = create<IntegrationState>()((set, get) => ({
  integrationIdsByOrgId: {},
  integrationsById: {},
  status: 'idle',
  error: null,
  lastFetchedAt: null,

  setIntegrationsForOrg: (orgId, integrations) =>
    set((state) => {
      const integrationsById = { ...state.integrationsById };
      const existingIds = state.integrationIdsByOrgId[orgId] ?? [];
      for (const id of existingIds) delete integrationsById[id];
      const nextIds: string[] = [];
      for (const integration of integrations) {
        const id = integration._id;
        integrationsById[id] = integration;
        nextIds.push(id);
      }
      return {
        integrationsById,
        integrationIdsByOrgId: {
          ...state.integrationIdsByOrgId,
          [orgId]: nextIds,
        },
        status: 'loaded',
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  upsertIntegration: (integration) =>
    set((state) => {
      const id = integration._id;
      const orgId = integration.organisationId;
      const integrationsById = {
        ...state.integrationsById,
        [id]: integration,
      };
      const existingIds = state.integrationIdsByOrgId[orgId] ?? [];
      const integrationIdsByOrgId = {
        ...state.integrationIdsByOrgId,
        [orgId]: existingIds.includes(id) ? existingIds : [...existingIds, id],
      };
      return {
        integrationsById,
        integrationIdsByOrgId,
        status: 'loaded',
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  getIntegrationsByOrgId: (orgId) => {
    const { integrationIdsByOrgId, integrationsById } = get();
    const ids = integrationIdsByOrgId[orgId] ?? [];
    return ids
      .map((id) => integrationsById[id])
      .filter((item): item is OrgIntegration => item != null);
  },

  getIntegrationByProvider: (orgId, provider) => {
    const normalizedProvider = provider.toLowerCase();
    return (
      get()
        .getIntegrationsByOrgId(orgId)
        .find(
          (integration) => String(integration.provider ?? '').toLowerCase() === normalizedProvider
        ) ?? null
    );
  },

  clearIntegrationsForOrg: (orgId) =>
    set((state) => {
      const ids = state.integrationIdsByOrgId[orgId] ?? [];
      const integrationsById = { ...state.integrationsById };
      for (const id of ids) delete integrationsById[id];
      const restIndex = { ...state.integrationIdsByOrgId };
      delete restIndex[orgId];
      return {
        integrationsById,
        integrationIdsByOrgId: restIndex,
        status: 'loaded',
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  clearIntegrations: () =>
    set(() => ({
      integrationIdsByOrgId: {},
      integrationsById: {},
      status: 'idle',
      error: null,
      lastFetchedAt: null,
    })),

  startLoading: () => set(() => ({ status: 'loading', error: null })),
  endLoading: () =>
    set(() => ({
      status: 'loaded',
      error: null,
      lastFetchedAt: new Date().toISOString(),
    })),
  setError: (message) => set(() => ({ status: 'error', error: message })),
}));
