import { listOrganisationFormAssignments } from '@/app/features/forms/services/formAssignmentService';

const getDataMock = jest.fn();

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  getData: (...args: any[]) => getDataMock(...args),
  postData: jest.fn(),
  default: { get: jest.fn() },
}));

describe('listOrganisationFormAssignments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getDataMock.mockResolvedValue({ data: [] });
  });

  it('calls the org-wide assignments endpoint with no params when no filters', async () => {
    await listOrganisationFormAssignments('org-1');
    expect(getDataMock).toHaveBeenCalledWith('/v1/forms/organisations/org-1/assignments', {});
  });

  it('passes parent, companion, and comma-joined status filters', async () => {
    await listOrganisationFormAssignments('org-1', {
      parentId: 'par-2',
      companionId: 'pat-3',
      status: ['SENT', 'SIGNED'],
    });
    expect(getDataMock).toHaveBeenCalledWith('/v1/forms/organisations/org-1/assignments', {
      parentId: 'par-2',
      companionId: 'pat-3',
      status: 'SENT,SIGNED',
    });
  });

  it('omits an empty status array from the params', async () => {
    await listOrganisationFormAssignments('org-1', { status: [] });
    expect(getDataMock).toHaveBeenCalledWith('/v1/forms/organisations/org-1/assignments', {});
  });

  it('returns the response rows', async () => {
    const rows = [{ id: 'fa_1', status: 'SIGNED' }];
    getDataMock.mockResolvedValue({ data: rows });
    await expect(listOrganisationFormAssignments('org-1')).resolves.toEqual(rows);
  });

  it('falls back to an empty array when the response has no data', async () => {
    getDataMock.mockResolvedValue({ data: undefined });
    await expect(listOrganisationFormAssignments('org-1')).resolves.toEqual([]);
  });
});
