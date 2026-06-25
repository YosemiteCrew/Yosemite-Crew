import api, { getData } from '@/app/services/axios';
import {
  downloadApplePass,
  getGoogleWalletUrl,
  getPetPassport,
} from '@/app/features/petPassport/services/petPassport.service';
import { useOrgStore } from '@/app/stores/orgStore';

jest.mock('@/app/services/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  getData: jest.fn(),
}));
jest.mock('@/app/stores/orgStore', () => ({ useOrgStore: { getState: jest.fn() } }));

const mockedGet = getData as jest.Mock;
const mockedApiGet = api.get as jest.Mock;

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

describe('downloadApplePass', () => {
  beforeEach(() => {
    (URL.createObjectURL as unknown) = jest.fn(() => 'blob:url');
    (URL.revokeObjectURL as unknown) = jest.fn();
  });

  it('fetches the signed pkpass over the authed channel and triggers a download', async () => {
    const blob = new Blob(['pk']);
    mockedApiGet.mockResolvedValue({ data: blob });
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await downloadApplePass('pat-1', 'Doggy');

    expect(mockedApiGet).toHaveBeenCalledWith(
      '/v1/pet-passport/pms/organisation/org-1/companion/pat-1/wallet/apple',
      { responseType: 'blob' }
    );
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:url');
    clickSpy.mockRestore();
  });

  it('throws when no organisation is selected', async () => {
    (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
    await expect(downloadApplePass('pat-1', 'Doggy')).rejects.toThrow(
      'No active organisation selected.'
    );
  });
});

describe('getGoogleWalletUrl', () => {
  it('returns the save url from the org-scoped endpoint', async () => {
    mockedGet.mockResolvedValue({
      data: { saveUrl: 'https://pay.google.com/gp/v/save/tok' },
    });
    const url = await getGoogleWalletUrl('pat-1');
    expect(mockedGet).toHaveBeenCalledWith(
      '/v1/pet-passport/pms/organisation/org-1/companion/pat-1/wallet/google'
    );
    expect(url).toBe('https://pay.google.com/gp/v/save/tok');
  });

  it('throws when no organisation is selected', async () => {
    (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
    await expect(getGoogleWalletUrl('pat-1')).rejects.toThrow('No active organisation selected.');
  });
});
