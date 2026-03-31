import { act, renderHook, waitFor } from '@testing-library/react';
import { useResolvedMerckIntegrationForPrimaryOrg } from '@/app/hooks/useMerckIntegration';

const mockUseOrgStore = jest.fn();
const mockUseIntegrationsForPrimaryOrg = jest.fn();
const mockGetStatus = jest.fn();

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => mockUseOrgStore(selector),
}));

jest.mock('@/app/hooks/useIntegrations', () => ({
  useIntegrationsForPrimaryOrg: () => mockUseIntegrationsForPrimaryOrg(),
}));

jest.mock('@/app/features/integrations/services/merckService', () => ({
  getMerckGateway: () => ({
    getStatus: mockGetStatus,
  }),
}));

describe('useResolvedMerckIntegrationForPrimaryOrg', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockUseIntegrationsForPrimaryOrg.mockReturnValue([]);
    mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
  });

  it('returns disabled when no primary org id exists', async () => {
    mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: null }));

    const { result } = renderHook(() => useResolvedMerckIntegrationForPrimaryOrg());

    await waitFor(() => {
      expect(result.current.primaryOrgId).toBeNull();
      expect(result.current.integration).toBeNull();
      expect(result.current.isEnabled).toBe(false);
    });
    expect(mockGetStatus).not.toHaveBeenCalled();
  });

  it('loads integration and computes enabled state', async () => {
    mockGetStatus.mockResolvedValue({ status: 'ENABLED', id: 'int-1' });

    const { result } = renderHook(() => useResolvedMerckIntegrationForPrimaryOrg());

    await waitFor(() => {
      expect(result.current.integration).toEqual({ status: 'ENABLED', id: 'int-1' });
      expect(result.current.isEnabled).toBe(true);
    });

    expect(mockGetStatus).toHaveBeenCalledWith('org-1', []);
  });

  it('refresh re-fetches integration and handles fetch errors', async () => {
    mockGetStatus
      .mockResolvedValueOnce({ status: 'disabled', id: 'int-2' })
      .mockRejectedValueOnce(new Error('fetch failed'));

    const { result } = renderHook(() => useResolvedMerckIntegrationForPrimaryOrg());

    await waitFor(() => {
      expect(result.current.integration).toEqual({ status: 'disabled', id: 'int-2' });
      expect(result.current.isEnabled).toBe(false);
    });

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.integration).toBeNull();
      expect(result.current.isEnabled).toBe(false);
    });

    expect(mockGetStatus).toHaveBeenCalledTimes(2);
  });
});
