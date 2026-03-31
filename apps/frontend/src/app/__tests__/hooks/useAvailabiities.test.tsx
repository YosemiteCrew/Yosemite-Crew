import { renderHook, waitFor } from '@testing-library/react';
import { useLoadAvailabilities, usePrimaryAvailability } from '@/app/hooks/useAvailabiities';
import { loadAvailability } from '@/app/features/organization/services/availabilityService';

const mockUseAvailabilityStore = jest.fn();
const mockUseOrgStore = jest.fn();
const mockUseAuthStore = jest.fn();
const mockConvertFromGetApi = jest.fn();

jest.mock('@/app/features/organization/services/availabilityService', () => ({
  loadAvailability: jest.fn(),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: (selector: any) => mockUseOrgStore(selector),
}));

jest.mock('@/app/stores/availabilityStore', () => ({
  useAvailabilityStore: (selector: any) => mockUseAvailabilityStore(selector),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: (selector: any) => mockUseAuthStore(selector),
}));

jest.mock('@/app/features/appointments/components/Availability/utils', () => ({
  convertFromGetApi: (...args: any[]) => mockConvertFromGetApi(...args),
}));

describe('useLoadAvailabilities', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockUseOrgStore.mockImplementation((selector: any) => selector({ orgIds: ['org-1'] }));
    mockUseAvailabilityStore.mockImplementation((selector: any) => selector({ status: 'idle' }));
  });

  it('loads availability when status is idle and org ids exist', async () => {
    renderHook(() => useLoadAvailabilities());

    await waitFor(() => {
      expect(loadAvailability).toHaveBeenCalledTimes(1);
    });
  });

  it('does not load when org ids are empty', async () => {
    mockUseOrgStore.mockImplementation((selector: any) => selector({ orgIds: [] }));

    renderHook(() => useLoadAvailabilities());

    await waitFor(() => {
      expect(loadAvailability).not.toHaveBeenCalled();
    });
  });

  it('does not load when status is not idle', async () => {
    mockUseAvailabilityStore.mockImplementation((selector: any) => selector({ status: 'success' }));

    renderHook(() => useLoadAvailabilities());

    await waitFor(() => {
      expect(loadAvailability).not.toHaveBeenCalled();
    });
  });
});

describe('usePrimaryAvailability', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({ attributes: { sub: 'Practitioner/USER-1' } })
    );
    mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
    mockUseAvailabilityStore.mockImplementation((selector: any) =>
      selector({
        availabilityIdsByOrgId: { 'org-1': ['a1', 'a2', 'a3'] },
        availabilitiesById: {
          a1: { _id: 'a1', userId: 'Practitioner/user-1' },
          a2: { _id: 'a2', userId: 'Practitioner/user-2' },
          a3: { _id: 'a3', userId: '' },
        },
      })
    );
    mockConvertFromGetApi.mockReturnValue({ mapped: true });
  });

  it('returns null when primary org is missing', () => {
    mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: null }));

    const { result } = renderHook(() => usePrimaryAvailability());
    expect(result.current.availabilities).toBeNull();
  });

  it('prefers user-specific rows when matched', () => {
    const { result } = renderHook(() => usePrimaryAvailability());

    expect(mockConvertFromGetApi).toHaveBeenCalledWith([
      { _id: 'a1', userId: 'Practitioner/user-1' },
    ]);
    expect(result.current.availabilities).toEqual({ mapped: true });
  });

  it('falls back to org-level rows when no user-specific row matches', () => {
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({ attributes: { sub: 'unknown' } })
    );

    renderHook(() => usePrimaryAvailability());

    expect(mockConvertFromGetApi).toHaveBeenCalledWith([{ _id: 'a3', userId: '' }]);
  });
});
