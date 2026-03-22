import {
  isAllowedMerckUrl,
  merckApi,
  normalizeMerckSearchPayload,
} from '@/features/merck/services/merckService';
import apiClient from '@/shared/services/apiClient';

jest.mock('@/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
  withAuthHeaders: jest.fn((token: string) => ({
    Authorization: `Bearer ${token}`,
  })),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('merckService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts supported Merck/MSD domains and blocks professional links', () => {
    expect(isAllowedMerckUrl('https://www.msdvetmanual.com/disease')).toBe(
      true,
    );
    expect(isAllowedMerckUrl('https://www.merckmanuals.com/home/topic')).toBe(
      true,
    );
    expect(
      isAllowedMerckUrl('https://www.msdmanuals.com/professional/topic'),
    ).toBe(false);
    expect(isAllowedMerckUrl('https://example.com/topic')).toBe(false);
  });

  it('normalizes raw feed payload and keeps consumer-safe links only', () => {
    const payload = {
      feed: {
        id: 'feed-1',
        updated: '2026-03-01T00:00:00.000Z',
        entry: [
          {
            id: 'entry-1',
            title: {'#text': 'Canine fever'},
            summary:
              '<div><p>Summary text</p><a href="https://www.msdvetmanual.com/topic#overview">Overview</a></div>',
            updated: '2026-03-01T00:00:00.000Z',
            link: {'@href': 'https://www.msdvetmanual.com/topic'},
          },
          {
            id: 'entry-2',
            title: {'#text': 'Blocked professional'},
            summary:
              '<div><p>Professional text</p><a href="https://www.msdmanuals.com/professional/xyz">Bad</a></div>',
            updated: '2026-03-01T00:00:00.000Z',
            link: {'@href': 'https://www.msdmanuals.com/professional/xyz'},
          },
        ],
      },
    };

    const normalized = normalizeMerckSearchPayload(payload, {
      language: 'en',
      media: 'hybrid',
    });

    expect(normalized.entries).toHaveLength(1);
    expect(normalized.entries[0].title).toBe('Canine fever');
    expect(normalized.entries[0].subLinks[0].label).toBe('Full Summary');
    expect(normalized.meta.audience).toBe('PAT');
  });

  it('calls backend search endpoint with PAT audience for mobile', async () => {
    mockApiClient.get.mockResolvedValue({
      data: {
        meta: {
          requestId: 'req-1',
          audience: 'PAT',
          language: 'en',
          totalResults: 1,
        },
        entries: [
          {
            id: 'entry-1',
            title: 'Topic',
            summaryText: 'Summary',
            updatedAt: null,
            audience: 'PAT',
            primaryUrl: 'https://www.msdvetmanual.com/topic',
            subLinks: [],
          },
        ],
      },
    });

    const response = await merckApi.searchManuals({
      organisationId: 'org-1',
      query: 'fever',
      accessToken: 'token-1',
      language: 'es',
      media: 'full',
    });

    expect(mockApiClient.get).toHaveBeenCalledWith(
      '/v1/knowledge/pms/organisation/org-1/merck/manuals/search',
      expect.objectContaining({
        params: {
          q: 'fever',
          audience: 'PAT',
          language: 'es',
          media: 'full',
        },
      }),
    );
    expect(response.entries).toHaveLength(1);
    expect(response.meta.audience).toBe('PAT');
  });
});
