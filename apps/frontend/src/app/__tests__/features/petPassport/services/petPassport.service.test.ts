import { getPetPassport } from '@/app/features/petPassport/services/petPassport.service';
import { getData } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';

jest.mock('@/app/services/axios', () => ({ getData: jest.fn() }));
jest.mock('@/app/stores/orgStore', () => ({ useOrgStore: { getState: jest.fn() } }));

const mockedGet = getData as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: 'org-1' });
});

describe('getPetPassport', () => {
  it('fetches the passport at the org-scoped path', async () => {
    mockedGet.mockResolvedValue({ data: { identity: { name: 'Doggy' } } });
    const res = await getPetPassport('pat-1');
    expect(mockedGet).toHaveBeenCalledWith(
      '/v1/pet-passport/pms/organisation/org-1/companion/pat-1/passport'
    );
    expect(res).toEqual({ identity: { name: 'Doggy' } });
  });

  it('throws when no organisation is selected', async () => {
    (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
    await expect(getPetPassport('pat-1')).rejects.toThrow('No active organisation selected.');
  });
});
