import {
  issueShareToken,
  listShareTokens,
  revokeShareToken,
  getPublicCompanionCard,
} from '@/app/features/companionCard/services/companionCard.service';
import { getData, postData, deleteData } from '@/app/services/axios';
import { useOrgStore } from '@/app/stores/orgStore';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
  deleteData: jest.fn(),
}));
jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: { getState: jest.fn() },
}));

const mockedGet = getData as jest.Mock;
const mockedPost = postData as jest.Mock;
const mockedDelete = deleteData as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: 'org-1' });
});

describe('companionCard.service', () => {
  it('issues a share token at the org-scoped path', async () => {
    mockedPost.mockResolvedValue({ data: { token: 'raw', qrPayload: '/card/raw', share: {} } });
    const result = await issueShareToken('pat-1', { audience: 'PUBLIC' });
    expect(mockedPost).toHaveBeenCalledWith(
      '/v1/companion-card/pms/organisation/org-1/companion/pat-1/share',
      { audience: 'PUBLIC' }
    );
    expect(result.token).toBe('raw');
  });

  it('lists share tokens', async () => {
    mockedGet.mockResolvedValue({ data: { tokens: [{ id: 's1' }] } });
    await expect(listShareTokens('pat-1')).resolves.toEqual([{ id: 's1' }]);
    expect(mockedGet).toHaveBeenCalledWith(
      '/v1/companion-card/pms/organisation/org-1/companion/pat-1/shares'
    );
  });

  it('revokes a token at the org-scoped path', async () => {
    mockedDelete.mockResolvedValue({ data: { id: 's1' } });
    await revokeShareToken('tok-1');
    expect(mockedDelete).toHaveBeenCalledWith(
      '/v1/companion-card/pms/organisation/org-1/share/tok-1'
    );
  });

  it('throws when no organisation is selected', async () => {
    (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
    await expect(listShareTokens('pat-1')).rejects.toThrow('No active organisation selected.');
  });

  it('fetches the public card via a raw fetch', async () => {
    const json = jest.fn().mockResolvedValue({ audience: 'PUBLIC' });
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json }) as unknown as typeof fetch;
    await expect(getPublicCompanionCard('tok')).resolves.toEqual({ audience: 'PUBLIC' });
  });

  it('throws when the public card is not found', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    await expect(getPublicCompanionCard('tok')).rejects.toThrow('Card not found.');
  });
});
