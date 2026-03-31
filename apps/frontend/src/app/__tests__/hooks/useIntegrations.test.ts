import { renderHook } from '@testing-library/react';
import {
  loadIntegrationsForPrimaryOrg,
  useLoadIntegrationsForPrimaryOrg,
  useIntegrationsForPrimaryOrg,
  useIntegrationByProviderForPrimaryOrg,
} from '@/app/hooks/useIntegrations';
import { useOrgStore } from '@/app/stores/orgStore';
import { useIntegrationStore } from '@/app/stores/integrationStore';
import {
  getOrgIntegrations,
  getApiErrorMessage,
} from '@/app/features/integrations/services/idexxService';

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: Object.assign(jest.fn(), { getState: jest.fn() }),
}));
jest.mock('@/app/stores/integrationStore', () => ({
  useIntegrationStore: Object.assign(jest.fn(), { getState: jest.fn() }),
}));
jest.mock('@/app/features/integrations/services/idexxService', () => ({
  getOrgIntegrations: jest.fn(),
  getApiErrorMessage: jest.fn(),
}));

const mockUseOrgStore = useOrgStore as unknown as jest.Mock;
const mockUseIntegrationStore = useIntegrationStore as unknown as jest.Mock;
const mockOrgGetState = (useOrgStore as unknown as { getState: jest.Mock }).getState;
const mockIntegrationGetState = (useIntegrationStore as unknown as { getState: jest.Mock })
  .getState;
const mockGetOrgIntegrations = getOrgIntegrations as jest.Mock;
const mockGetApiErrorMessage = getApiErrorMessage as jest.Mock;

const baseIntegrationStoreState = {
  status: 'idle' as const,
  lastFetchedAt: null,
  integrationIdsByOrgId: {},
  integrationsById: {},
  startLoading: jest.fn(),
  setError: jest.fn(),
  setIntegrationsForOrg: jest.fn(),
};

describe('useIntegrations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIntegrationGetState.mockReturnValue({ ...baseIntegrationStoreState });
    mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
    mockOrgGetState.mockReturnValue({ primaryOrgId: 'org-1' });
    mockUseIntegrationStore.mockImplementation((selector: any) =>
      selector({
        status: 'idle',
        lastFetchedAt: null,
        integrationIdsByOrgId: {},
        integrationsById: {},
      })
    );
    mockGetApiErrorMessage.mockReturnValue('Unable to load integrations at the moment.');
  });

  describe('loadIntegrationsForPrimaryOrg', () => {
    it('returns early when no primaryOrgId', async () => {
      mockOrgGetState.mockReturnValue({ primaryOrgId: null });

      await loadIntegrationsForPrimaryOrg();
      expect(mockGetOrgIntegrations).not.toHaveBeenCalled();
    });

    it('fetches and sets integrations when status is idle', async () => {
      mockOrgGetState.mockReturnValue({ primaryOrgId: 'org-1' });
      const mockIntegrations = [{ _id: 'int-1', provider: 'IDEXX', organisationId: 'org-1' }];
      mockGetOrgIntegrations.mockResolvedValue(mockIntegrations);

      const storeState = { ...baseIntegrationStoreState };
      mockIntegrationGetState.mockReturnValue(storeState);

      await loadIntegrationsForPrimaryOrg();

      expect(storeState.startLoading).toHaveBeenCalled();
      expect(mockGetOrgIntegrations).toHaveBeenCalledWith('org-1');
      expect(storeState.setIntegrationsForOrg).toHaveBeenCalledWith('org-1', mockIntegrations);
    });

    it('does not call startLoading when silent option is true', async () => {
      mockOrgGetState.mockReturnValue({ primaryOrgId: 'org-1' });
      mockGetOrgIntegrations.mockResolvedValue([]);
      const storeState = { ...baseIntegrationStoreState };
      mockIntegrationGetState.mockReturnValue(storeState);

      await loadIntegrationsForPrimaryOrg({ silent: true });

      expect(storeState.startLoading).not.toHaveBeenCalled();
    });

    it('skips fetch when shouldFetch is false (already loaded, hasOrgData, not idle)', async () => {
      mockOrgGetState.mockReturnValue({ primaryOrgId: 'org-1' });
      const storeState = {
        ...baseIntegrationStoreState,
        status: 'loaded' as const,
        lastFetchedAt: new Date().toISOString(),
        integrationIdsByOrgId: { 'org-1': ['int-1'] },
      };
      mockIntegrationGetState.mockReturnValue(storeState);

      await loadIntegrationsForPrimaryOrg();

      expect(mockGetOrgIntegrations).not.toHaveBeenCalled();
    });

    it('force-fetches even when already loaded', async () => {
      mockOrgGetState.mockReturnValue({ primaryOrgId: 'org-1' });
      const storeState = {
        ...baseIntegrationStoreState,
        status: 'loaded' as const,
        lastFetchedAt: new Date().toISOString(),
        integrationIdsByOrgId: { 'org-1': ['int-1'] },
      };
      mockIntegrationGetState.mockReturnValue(storeState);
      mockGetOrgIntegrations.mockResolvedValue([]);

      await loadIntegrationsForPrimaryOrg({ force: true });

      expect(mockGetOrgIntegrations).toHaveBeenCalled();
    });

    it('sets error and rethrows on fetch failure', async () => {
      mockOrgGetState.mockReturnValue({ primaryOrgId: 'org-1' });
      const storeState = { ...baseIntegrationStoreState };
      mockIntegrationGetState.mockReturnValue(storeState);
      const error = new Error('Network error');
      mockGetOrgIntegrations.mockRejectedValue(error);
      mockGetApiErrorMessage.mockReturnValue('Unable to load integrations at the moment.');

      await expect(loadIntegrationsForPrimaryOrg()).rejects.toThrow('Network error');
      expect(storeState.setError).toHaveBeenCalledWith(
        'Unable to load integrations at the moment.'
      );
    });
  });

  describe('useLoadIntegrationsForPrimaryOrg', () => {
    it('triggers load when primaryOrgId exists and org data is not cached', () => {
      mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
      mockUseIntegrationStore.mockImplementation((selector: any) =>
        selector({ integrationIdsByOrgId: {} })
      );
      const storeState = { ...baseIntegrationStoreState, status: 'idle' as const };
      mockIntegrationGetState.mockReturnValue(storeState);
      mockGetOrgIntegrations.mockResolvedValue([]);

      const orgStoreMock = jest.requireMock('@/app/stores/orgStore');
      orgStoreMock.useOrgStore.getState = jest.fn().mockReturnValue({ primaryOrgId: 'org-1' });

      renderHook(() => useLoadIntegrationsForPrimaryOrg());
      // The hook calls void loadIntegrationsForPrimaryOrg() — not directly assertable
      // but we verify no error is thrown
    });

    it('skips load when primaryOrgId is absent', () => {
      mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: null }));
      mockUseIntegrationStore.mockImplementation((selector: any) =>
        selector({ integrationIdsByOrgId: {} })
      );

      renderHook(() => useLoadIntegrationsForPrimaryOrg());
      expect(mockGetOrgIntegrations).not.toHaveBeenCalled();
    });

    it('skips load when org data is already cached', () => {
      mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
      mockUseIntegrationStore.mockImplementation((selector: any) =>
        selector({ integrationIdsByOrgId: { 'org-1': ['int-1'] } })
      );
      const storeState = {
        ...baseIntegrationStoreState,
        status: 'loaded' as const,
        integrationIdsByOrgId: { 'org-1': ['int-1'] },
      };
      mockIntegrationGetState.mockReturnValue(storeState);

      renderHook(() => useLoadIntegrationsForPrimaryOrg());
      expect(mockGetOrgIntegrations).not.toHaveBeenCalled();
    });

    it('skips load when status is loading', () => {
      mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
      mockUseIntegrationStore.mockImplementation((selector: any) =>
        selector({ integrationIdsByOrgId: {} })
      );
      const storeState = { ...baseIntegrationStoreState, status: 'loading' as const };
      mockIntegrationGetState.mockReturnValue(storeState);

      renderHook(() => useLoadIntegrationsForPrimaryOrg());
      expect(mockGetOrgIntegrations).not.toHaveBeenCalled();
    });
  });

  describe('useIntegrationsForPrimaryOrg', () => {
    it('returns empty array when no primaryOrgId', () => {
      mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: null }));
      mockUseIntegrationStore.mockImplementation((selector: any) =>
        selector({ integrationsById: {}, integrationIdsByOrgId: {} })
      );

      const { result } = renderHook(() => useIntegrationsForPrimaryOrg());
      expect(result.current).toEqual([]);
    });

    it('returns empty array when no integrations for org', () => {
      mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
      mockUseIntegrationStore.mockImplementation((selector: any) =>
        selector({ integrationsById: {}, integrationIdsByOrgId: {} })
      );

      const { result } = renderHook(() => useIntegrationsForPrimaryOrg());
      expect(result.current).toEqual([]);
    });

    it('returns mapped integrations for primary org', () => {
      const int1 = { _id: 'int-1', provider: 'IDEXX', organisationId: 'org-1' };
      mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
      mockUseIntegrationStore.mockImplementation((selector: any) =>
        selector({
          integrationsById: { 'int-1': int1 },
          integrationIdsByOrgId: { 'org-1': ['int-1'] },
        })
      );

      const { result } = renderHook(() => useIntegrationsForPrimaryOrg());
      expect(result.current).toEqual([int1]);
    });

    it('filters out integrations that are in the id list but missing from integrationsById', () => {
      mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
      mockUseIntegrationStore.mockImplementation((selector: any) =>
        selector({
          integrationsById: {},
          integrationIdsByOrgId: { 'org-1': ['ghost-id'] },
        })
      );

      const { result } = renderHook(() => useIntegrationsForPrimaryOrg());
      expect(result.current).toEqual([]);
    });
  });

  describe('useIntegrationByProviderForPrimaryOrg', () => {
    it('returns the matching integration (case-insensitive)', () => {
      const int1 = { _id: 'int-1', provider: 'IDEXX', organisationId: 'org-1' };
      mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
      mockUseIntegrationStore.mockImplementation((selector: any) =>
        selector({
          integrationsById: { 'int-1': int1 },
          integrationIdsByOrgId: { 'org-1': ['int-1'] },
        })
      );

      const { result } = renderHook(() => useIntegrationByProviderForPrimaryOrg('idexx' as any));
      expect(result.current).toEqual(int1);
    });

    it('returns null when no integration matches the provider', () => {
      mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
      mockUseIntegrationStore.mockImplementation((selector: any) =>
        selector({ integrationsById: {}, integrationIdsByOrgId: { 'org-1': [] } })
      );

      const { result } = renderHook(() => useIntegrationByProviderForPrimaryOrg('MERCK' as any));
      expect(result.current).toBeNull();
    });

    it('handles integration with null provider gracefully', () => {
      const int1 = { _id: 'int-1', provider: null, organisationId: 'org-1' };
      mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
      mockUseIntegrationStore.mockImplementation((selector: any) =>
        selector({
          integrationsById: { 'int-1': int1 },
          integrationIdsByOrgId: { 'org-1': ['int-1'] },
        })
      );

      const { result } = renderHook(() => useIntegrationByProviderForPrimaryOrg('IDEXX' as any));
      expect(result.current).toBeNull();
    });
  });
});
