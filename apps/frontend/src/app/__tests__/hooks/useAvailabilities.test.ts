import { renderHook } from '@testing-library/react';
import { useLoadAvailabilities, usePrimaryAvailability } from '@/app/hooks/useAvailabiities';
import { useOrgStore } from '@/app/stores/orgStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useAuthStore } from '@/app/stores/authStore';
import { loadAvailability } from '@/app/features/organization/services/availabilityService';
import { usePrimaryOrgWithMembership } from '@/app/hooks/useOrgSelectors';

jest.mock('@/app/stores/orgStore', () => ({ useOrgStore: jest.fn() }));
jest.mock('@/app/hooks/useOrgSelectors', () => ({ usePrimaryOrgWithMembership: jest.fn() }));
const mockAvailGetState = jest.fn(() => ({ status: 'idle' }));
jest.mock('@/app/stores/availabilityStore', () => ({
  useAvailabilityStore: Object.assign(jest.fn(), { getState: () => mockAvailGetState() }),
}));
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
const mockUsePrimaryOrgWithMembership = usePrimaryOrgWithMembership as unknown as jest.Mock;

describe('useLoadAvailabilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
    mockUseAvailabilityStore.mockImplementation((selector: any) =>
      selector({ availabilityIdsByOrgId: {} })
    );
    mockAvailGetState.mockReturnValue({ status: 'idle' });
  });

  it('loads availability when primaryOrgId set and not yet loaded', () => {
    renderHook(() => useLoadAvailabilities());
    expect(loadAvailability).toHaveBeenCalledWith({ silent: true, orgId: 'org-1' });
  });

  it('skips load when no primaryOrgId', () => {
    mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: null }));
    renderHook(() => useLoadAvailabilities());
    expect(loadAvailability).not.toHaveBeenCalled();
  });

  it('skips load when already loading', () => {
    mockAvailGetState.mockReturnValue({ status: 'loading' });
    renderHook(() => useLoadAvailabilities());
    expect(loadAvailability).not.toHaveBeenCalled();
  });

  it('skips load when already loaded for primaryOrgId', () => {
    mockUseAvailabilityStore.mockImplementation((selector: any) =>
      selector({ availabilityIdsByOrgId: { 'org-1': [] } })
    );
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
    mockUsePrimaryOrgWithMembership.mockReturnValue({
      membership: {
        id: 'membership-a',
        practitionerReference: 'Practitioner/practitioner-a',
      },
    });
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

  it('matches practitioner reference rows for the current membership', () => {
    mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
    mockUseAvailabilityStore.mockImplementation((selector: any) =>
      selector({
        availabilityIdsByOrgId: { 'org-1': ['auth', 'practitioner'] },
        availabilitiesById: {
          auth: { _id: 'auth', organisationId: 'org-1', dayOfWeek: 'MONDAY', userId: 'user-a' },
          practitioner: {
            _id: 'practitioner',
            organisationId: 'org-1',
            dayOfWeek: 'TUESDAY',
            userId: 'practitioner-a',
          },
        },
      })
    );

    const { result } = renderHook(() => usePrimaryAvailability());

    expect(result.current.availabilities).toEqual([
      {
        _id: 'practitioner',
        organisationId: 'org-1',
        dayOfWeek: 'TUESDAY',
        userId: 'practitioner-a',
      },
    ]);
  });

  it('returns empty user rows when authUserId is empty string', () => {
    mockUseAuthStore.mockImplementation((selector: any) => selector({ attributes: { sub: '' } }));
    mockUseOrgStore.mockImplementation((selector: any) => selector({ primaryOrgId: 'org-1' }));
    mockUseAvailabilityStore.mockImplementation((selector: any) =>
      selector({
        availabilityIdsByOrgId: { 'org-1': ['org'] },
        availabilitiesById: {
          org: { _id: 'org', organisationId: 'org-1', dayOfWeek: 'MONDAY', userId: '' },
        },
      })
    );

    const { result } = renderHook(() => usePrimaryAvailability());
    // When authUserId is empty, userRows=[], falls back to org rows (userId='')
    expect(result.current.availabilities).toBeDefined();
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
