import {
  createOveride,
  deleteOveride,
  getOveridesForPrimaryDate,
  loadAvailability,
  loadTeamAvailability,
  upsertAvailability,
  upsertTeamAvailability,
} from '@/app/features/organization/services/availabilityService';
import { deleteData, getData, postData } from '@/app/services/axios';

const mockOrgGetState = jest.fn();
const mockAvailabilityGetState = jest.fn();

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: { getState: () => mockOrgGetState() },
}));

jest.mock('@/app/stores/availabilityStore', () => ({
  useAvailabilityStore: { getState: () => mockAvailabilityGetState() },
}));

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
  deleteData: jest.fn(),
}));

describe('availabilityService', () => {
  const setAvailabilitiesForOrg = jest.fn();
  const setAvailabilities = jest.fn();
  const startLoading = jest.fn();
  const upsertOverideStore = jest.fn();
  const removeOverride = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    mockOrgGetState.mockReturnValue({ primaryOrgId: 'org-1', orgIds: ['org-1', 'org-2'] });
    mockAvailabilityGetState.mockReturnValue({
      setAvailabilitiesForOrg,
      setAvailabilities,
      startLoading,
      upsertOverideStore,
      removeOverride,
    });
  });

  it('upserts primary org availability and updates store', async () => {
    (postData as jest.Mock).mockResolvedValue({ data: { data: [{ day: 'MON' }] } });

    await upsertAvailability({} as any, null);

    expect(postData).toHaveBeenCalledWith('/fhir/v1/availability/org-1/base', {});
    expect(setAvailabilitiesForOrg).toHaveBeenCalledWith('org-1', [{ day: 'MON' }]);
  });

  it('returns early when org id is missing', async () => {
    mockOrgGetState.mockReturnValue({ primaryOrgId: null, orgIds: [] });

    await upsertAvailability({} as any, null);

    expect(postData).not.toHaveBeenCalled();
  });

  it('upserts team availability and returns payload', async () => {
    (postData as jest.Mock).mockResolvedValue({ data: { data: [{ day: 'TUE' }] } });

    const res = await upsertTeamAvailability({ practionerId: 'prac-1' } as any, {} as any, 'org-2');

    expect(postData).toHaveBeenCalledWith('/fhir/v1/availability/org-2/prac-1/base', {});
    expect(res).toEqual([{ day: 'TUE' }]);
  });

  it('loads all org availability and merges settled results', async () => {
    (getData as jest.Mock)
      .mockResolvedValueOnce({ data: { data: [{ org: 'org-1' }] } })
      .mockResolvedValueOnce({ data: { data: [{ org: 'org-2' }] } });

    await loadAvailability();

    expect(startLoading).toHaveBeenCalledTimes(1);
    expect(setAvailabilities).toHaveBeenCalledWith([{ org: 'org-1' }, { org: 'org-2' }]);
  });

  it('skips loader in silent mode and returns when no org ids', async () => {
    mockOrgGetState.mockReturnValue({ primaryOrgId: 'org-1', orgIds: [] });

    await loadAvailability({ silent: true });

    expect(startLoading).not.toHaveBeenCalled();
    expect(getData).not.toHaveBeenCalled();
  });

  it('loads team availability for org', async () => {
    (getData as jest.Mock).mockResolvedValue({ data: { data: [{ day: 'WED' }] } });

    await loadTeamAvailability('org-3');

    expect(getData).toHaveBeenCalledWith('/fhir/v1/availability/org-3/base/all');
    expect(setAvailabilitiesForOrg).toHaveBeenCalledWith('org-3', [{ day: 'WED' }]);
  });

  it('loads overrides for primary org date', async () => {
    (getData as jest.Mock).mockResolvedValue({ data: { data: [{ _id: 'o1' }] } });

    await getOveridesForPrimaryDate(new Date('2026-04-01T00:00:00.000Z'));

    expect(getData).toHaveBeenCalledWith(
      '/fhir/v1/availability/org-1/weekly?weekStartDate=2026-04-01'
    );
    expect(upsertOverideStore).toHaveBeenCalledWith([{ _id: 'o1' }]);
  });

  it('throws when primary org is missing for override operations', async () => {
    mockOrgGetState.mockReturnValue({ primaryOrgId: null, orgIds: [] });

    await expect(getOveridesForPrimaryDate(new Date())).rejects.toThrow(
      'No primary organization selected. Cannot load overides.'
    );
    await expect(createOveride({} as any)).rejects.toThrow(
      'No primary organization selected. Cannot create overides.'
    );
  });

  it('creates override and updates store', async () => {
    (postData as jest.Mock).mockResolvedValue({});

    await createOveride({ _id: 'o2' } as any);

    expect(postData).toHaveBeenCalledWith('/fhir/v1/availability/org-1/weekly', { _id: 'o2' });
    expect(upsertOverideStore).toHaveBeenCalledWith({ _id: 'o2' });
  });

  it('deletes override and removes store entry', async () => {
    (deleteData as jest.Mock).mockResolvedValue({});

    await deleteOveride({ _id: 'o3', dayOfWeek: '2026-04-01', organisationId: 'org-1' } as any);

    expect(deleteData).toHaveBeenCalledWith(
      '/fhir/v1/availability/org-1/weekly?weekStartDate=2026-04-01'
    );
    expect(removeOverride).toHaveBeenCalledWith('o3');
  });

  it('throws when override payload is invalid for delete', async () => {
    await expect(
      deleteOveride({ _id: '', dayOfWeek: '', organisationId: '' } as any)
    ).rejects.toThrow('Cannot delete overides.');
  });
});
