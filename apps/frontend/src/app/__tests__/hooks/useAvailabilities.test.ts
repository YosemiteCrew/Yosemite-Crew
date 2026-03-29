import { renderHook } from '@testing-library/react';
import { useLoadAvailabilities, usePrimaryAvailability } from '@/app/hooks/useAvailabiities';
import { useOrgStore } from '@/app/stores/orgStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useAuthStore } from '@/app/stores/authStore';
import { loadAvailability } from '@/app/features/organization/services/availabilityService';

jest.mock('@/app/stores/orgStore', () => ({ useOrgStore: jest.fn() }));
jest.mock('@/app/stores/availabilityStore', () => ({ useAvailabilityStore: jest.fn() }));
jest.mock('@/app/stores/authStore', () => ({ useAuthStore: jest.fn() }));
jest.mock('@/app/features/organization/services/availabilityService', () => ({
  loadAvailability: jest.fn(),
}));
jest.mock('@/app/features/appointments/components/Availability/utils', () => ({
  ...jest.requireActual('@/app/features/appointments/components/Availability/utils'),
  convertFromGetApi: jest.fn((items) => items),
}));

const mockUseOrgStore = useOrgStore as unknown as jest.Mock;
const mockUseAvailabilityStore = useAvailabilityStore as unknown as jest.Mock;
const mockUseAuthStore = useAuthStore as unknown as jest.Mock;

describe('useLoadAvailabilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOrgStore.mockImplementation((selector: any) => selector({ orgIds: ['org-1'] }));
    mockUseAvailabilityStore.mockImplementation((selector: any) => selector({ status: 'idle' }));
  });

  it('loads availability when idle and orgs exist', () => {
    renderHook(() => useLoadAvailabilities());
    expect(loadAvailability).toHaveBeenCalled();
  });

  it('skips load when no orgs or already loading', () => {
    mockUseOrgStore.mockImplementation((selector: any) => selector({ orgIds: [] }));
    renderHook(() => useLoadAvailabilities());
    expect(loadAvailability).not.toHaveBeenCalled();

    mockUseOrgStore.mockImplementation((selector: any) => selector({ orgIds: ['org-1'] }));
    mockUseAvailabilityStore.mockImplementation((selector: any) => selector({ status: 'loading' }));
    renderHook(() => useLoadAvailabilities());
    expect(loadAvailability).not.toHaveBeenCalled();
  });
});

describe('usePrimaryAvailability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({ attributes: { sub: 'user-a' } })
    );
  });

  it('returns null when no primary org', () => {
    mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: null }));
    mockUseAvailabilityStore.mockImplementation((selector: any) =>
      selector({ availabilityIdsByOrgId: {}, availabilitiesById: {} })
    );
    const { result } = renderHook(() => usePrimaryAvailability());
    expect(result.current.availabilities).toBeNull();
  });

  it('maps ids to availability objects', () => {
    mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
    mockUseAvailabilityStore.mockImplementation((selector: any) =>
      selector({
        availabilityIdsByOrgId: { 'org-1': ['a1'] },
        availabilitiesById: { a1: { id: 'a1' } },
      })
    );
    const { result } = renderHook(() => usePrimaryAvailability());
    expect(result.current.availabilities).toEqual([{ id: 'a1' }]);
  });

  it('prefers current user rows when base/all data is mixed', () => {
    mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
    mockUseAvailabilityStore.mockImplementation((selector: any) =>
      selector({
        availabilityIdsByOrgId: { 'org-1': ['org', 'mine', 'other'] },
        availabilitiesById: {
          org: { _id: 'org', organisationId: 'org-1', dayOfWeek: 'MONDAY', userId: '' },
          mine: { _id: 'mine', organisationId: 'org-1', dayOfWeek: 'MONDAY', userId: 'user-a' },
          other: { _id: 'other', organisationId: 'org-1', dayOfWeek: 'MONDAY', userId: 'user-b' },
        },
      })
    );

    const { result } = renderHook(() => usePrimaryAvailability());

    expect(result.current.availabilities).toEqual([
      { _id: 'mine', organisationId: 'org-1', dayOfWeek: 'MONDAY', userId: 'user-a' },
    ]);
  });

  it('falls back to org rows when current user rows are unavailable', () => {
    mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
    mockUseAvailabilityStore.mockImplementation((selector: any) =>
      selector({
        availabilityIdsByOrgId: { 'org-1': ['org', 'other'] },
        availabilitiesById: {
          org: { _id: 'org', organisationId: 'org-1', dayOfWeek: 'MONDAY', userId: '' },
          other: { _id: 'other', organisationId: 'org-1', dayOfWeek: 'MONDAY', userId: 'user-b' },
        },
      })
    );

    const { result } = renderHook(() => usePrimaryAvailability());

    expect(result.current.availabilities).toEqual([
      { _id: 'org', organisationId: 'org-1', dayOfWeek: 'MONDAY', userId: '' },
    ]);
  });
});
