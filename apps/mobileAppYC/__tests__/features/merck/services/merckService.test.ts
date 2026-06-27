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
    expect(isAllowedMerckUrl('http://www.msdvetmanual.com/disease')).toBe(
      false,
    );
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

  it('sanitizes html from normalized payload entries', () => {
    const normalized = normalizeMerckSearchPayload(
      {
        meta: {
          requestId: 'req-2',
          source: 'merck-live-feed',
          updatedAt: '2026-03-24T05:20:54Z',
          audience: 'PAT',
          language: 'en',
          totalResults: 1,
        },
        entries: [
          {
            id: 'entry-1',
            title: '<b>Rhinitis</b> in <i>Dogs</i>',
            summaryText:
              '<p>Inflammation <strong>of</strong> nasal passages.</p>',
            updatedAt: null,
            audience: 'PAT',
            primaryUrl: 'https://www.msdvetmanual.com/topic',
            subLinks: [],
          },
        ],
      },
      {
        language: 'en',
        media: 'hybrid',
      },
    );

    expect(normalized.entries[0].title).toBe('Rhinitis in Dogs');
    expect(normalized.entries[0].summaryText).toBe(
      'Inflammation of nasal passages.',
    );
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
      '/v1/knowledge/mobile/merck/manuals/search',
      expect.objectContaining({
        params: {
          organisationId: 'org-1',
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

  it('throws with response.data.message when API returns an error response', async () => {
    mockApiClient.get.mockRejectedValue({
      response: {data: {message: 'Service unavailable'}},
      message: 'Request failed',
    });

    await expect(
      merckApi.searchManuals({
        organisationId: 'org-1',
        query: 'fever',
        accessToken: 'token-1',
      }),
    ).rejects.toThrow('Service unavailable');
  });

  it('throws with error.message when API returns error without response body', async () => {
    mockApiClient.get.mockRejectedValue({message: 'Network Error'});

    await expect(
      merckApi.searchManuals({
        organisationId: 'org-1',
        query: 'fever',
        accessToken: 'token-1',
      }),
    ).rejects.toThrow('Network Error');
  });

  it('throws default message when error has no message at all', async () => {
    mockApiClient.get.mockRejectedValue({});

    await expect(
      merckApi.searchManuals({
        organisationId: 'org-1',
        query: 'fever',
        accessToken: 'token-1',
      }),
    ).rejects.toThrow('Unable to search Merck manuals right now.');
  });

  it('uses default language and media when not specified', async () => {
    mockApiClient.get.mockResolvedValue({
      data: {
        meta: {
          requestId: 'req-1',
          audience: 'PAT',
          language: 'en',
          totalResults: 0,
        },
        entries: [],
      },
    });

    await merckApi.searchManuals({
      organisationId: 'org-1',
      query: 'fever',
      accessToken: 'token-1',
    });

    expect(mockApiClient.get).toHaveBeenCalledWith(
      '/v1/knowledge/mobile/merck/manuals/search',
      expect.objectContaining({
        params: expect.objectContaining({language: 'en', media: 'hybrid'}),
      }),
    );
  });

  it('strips blocked sublinks from otherwise valid entries', () => {
    const result = normalizeMerckSearchPayload(
      {
        meta: {
          requestId: 'r1',
          source: 'test',
          updatedAt: null,
          audience: 'PAT',
          language: 'en',
          totalResults: 1,
        },
        entries: [
          {
            id: 'entry-1',
            title: 'Valid Topic',
            summaryText: 'Summary',
            updatedAt: null,
            audience: 'PAT',
            primaryUrl: 'https://www.msdvetmanual.com/topic',
            subLinks: [
              {label: 'Allowed', url: 'https://www.msdvetmanual.com/subtopic'},
              {
                label: 'Blocked',
                url: 'https://www.msdmanuals.com/professional/xyz',
              },
              {label: 'External', url: 'https://evil.com/page'},
            ],
          },
        ],
      },
      {language: 'en', media: 'hybrid'},
    );

    expect(result.entries).toHaveLength(1);
    const subLinks = result.entries[0].subLinks;
    const subLinkUrls = subLinks.map(l => l.url);
    expect(subLinkUrls).toEqual([
      'https://www.msdvetmanual.com/subtopic?media=hybrid',
    ]);
    expect(subLinkUrls).not.toContain(
      'https://www.msdmanuals.com/professional/xyz',
    );
    expect(subLinkUrls).not.toContain('https://evil.com/page');
  });

  it('filters out entire entries whose primaryUrl is blocked', () => {
    const result = normalizeMerckSearchPayload(
      {
        meta: {
          requestId: 'r1',
          source: 'test',
          updatedAt: null,
          audience: 'PAT',
          language: 'en',
          totalResults: 2,
        },
        entries: [
          {
            id: 'entry-good',
            title: 'Good',
            summaryText: '',
            updatedAt: null,
            audience: 'PAT',
            primaryUrl: 'https://www.msdvetmanual.com/good',
            subLinks: [],
          },
          {
            id: 'entry-blocked',
            title: 'Blocked',
            summaryText: '',
            updatedAt: null,
            audience: 'PAT',
            primaryUrl: 'https://evil.com/bad',
            subLinks: [],
          },
        ],
      },
      {language: 'en', media: 'hybrid'},
    );

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('entry-good');
  });

  it('handles a single atom entry (non-array) in the feed', () => {
    const result = normalizeMerckSearchPayload(
      {
        feed: {
          id: 'feed-1',
          updated: '2026-01-01T00:00:00Z',
          entry: {
            id: 'entry-1',
            title: {'#text': 'Single Entry'},
            summary: 'Single summary',
            updated: '2026-01-01T00:00:00Z',
            link: {'@href': 'https://www.msdvetmanual.com/single'},
          },
        },
      },
      {language: 'en', media: 'hybrid'},
    );

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].title).toBe('Single Entry');
  });

  it('drops atom entries that have no id or no primaryUrl', () => {
    const result = normalizeMerckSearchPayload(
      {
        feed: {
          id: 'feed-1',
          updated: '2026-01-01T00:00:00Z',
          entry: [
            {
              id: '',
              title: {'#text': 'No ID'},
              link: {'@href': 'https://www.msdvetmanual.com/topic'},
            },
            {id: 'valid-id', title: {'#text': 'No Link'}, link: {'@href': ''}},
            {
              id: 'valid-id-2',
              title: {'#text': 'Good'},
              link: {'@href': 'https://www.msdvetmanual.com/good'},
            },
          ],
        },
      },
      {language: 'en', media: 'hybrid'},
    );

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('valid-id-2');
  });

  it('infers PAT audience from feed category with informationrecipient scheme', () => {
    const result = normalizeMerckSearchPayload(
      {
        feed: {
          id: 'feed-cat',
          updated: '2026-01-01T00:00:00Z',
          category: {
            '@scheme': 'InformationRecipient',
            '@term': 'PAT',
          },
          entry: [],
        },
      },
      {language: 'en', media: 'hybrid'},
    );

    expect(result.meta.audience).toBe('PAT');
  });

  it('falls back to PAT audience when category term is not PAT', () => {
    const result = normalizeMerckSearchPayload(
      {
        feed: {
          id: 'feed-cat',
          updated: '2026-01-01T00:00:00Z',
          category: [{'@scheme': 'InformationRecipient', '@term': 'PRO'}],
          entry: [],
        },
      },
      {language: 'en', media: 'hybrid'},
    );

    expect(result.meta.audience).toBe('PAT');
  });

  it('applies media mode query param to all URLs in entries', () => {
    const result = normalizeMerckSearchPayload(
      {
        meta: {
          requestId: 'r1',
          source: 'test',
          updatedAt: null,
          audience: 'PAT',
          language: 'en',
          totalResults: 1,
        },
        entries: [
          {
            id: 'entry-1',
            title: 'Topic',
            summaryText: '',
            updatedAt: null,
            audience: 'PAT',
            primaryUrl: 'https://www.msdvetmanual.com/topic',
            subLinks: [{label: 'Sub', url: 'https://www.msdvetmanual.com/sub'}],
          },
        ],
      },
      {language: 'en', media: 'full'},
    );

    expect(result.entries[0].primaryUrl).toContain('media=full');
    expect(result.entries[0].subLinks[0].url).toContain('media=full');
  });

  it('deduplicates sublinks sharing the same canonical URL as primaryUrl', () => {
    const result = normalizeMerckSearchPayload(
      {
        feed: {
          id: 'feed-1',
          updated: '2026-01-01T00:00:00Z',
          entry: [
            {
              id: 'e1',
              title: {'#text': 'Topic'},
              summary:
                '<a href="https://www.msdvetmanual.com/topic">Full Summary</a>' +
                '<a href="https://www.msdvetmanual.com/topic">Duplicate</a>',
              updated: '2026-01-01T00:00:00Z',
              link: {'@href': 'https://www.msdvetmanual.com/topic'},
            },
          ],
        },
      },
      {language: 'en', media: 'hybrid'},
    );

    const subLinks = result.entries[0].subLinks;
    const urls = subLinks.map(l => l.url.split('?')[0]);
    const uniqueUrls = new Set(urls);
    expect(uniqueUrls.size).toBe(urls.length);
  });

  it('extracts anchor links and skips those with empty label or url', () => {
    const result = normalizeMerckSearchPayload(
      {
        feed: {
          id: 'feed-1',
          updated: '2026-01-01T00:00:00Z',
          entry: [
            {
              id: 'e1',
              title: {'#text': 'Topic'},
              summary:
                '<a href="">No URL anchor</a>' +
                '<a href="https://www.msdvetmanual.com/valid">   </a>' +
                '<a href="https://www.msdvetmanual.com/good">Good Link</a>',
              updated: '2026-01-01T00:00:00Z',
              link: {'@href': 'https://www.msdvetmanual.com/topic'},
            },
          ],
        },
      },
      {language: 'en', media: 'hybrid'},
    );

    const subLinks = result.entries[0].subLinks;
    // Only "Full Summary" (primaryUrl) and "Good Link" should appear
    expect(subLinks.length).toBe(2);
    expect(subLinks[1].label).toBe('Good Link');
  });

  it('handles an empty feed gracefully', () => {
    const result = normalizeMerckSearchPayload(
      {feed: {}},
      {language: 'en', media: 'hybrid'},
    );

    expect(result.entries).toHaveLength(0);
    expect(result.meta.totalResults).toBe(0);
  });

  it('readTextNode: handles plain string titles', () => {
    const result = normalizeMerckSearchPayload(
      {
        feed: {
          id: 'feed-1',
          updated: '2026-01-01T00:00:00Z',
          entry: [
            {
              id: 'e1',
              title: 'Plain string title',
              summary: '',
              updated: '2026-01-01T00:00:00Z',
              link: {'@href': 'https://www.msdvetmanual.com/topic'},
            },
          ],
        },
      },
      {language: 'en', media: 'hybrid'},
    );

    expect(result.entries[0].title).toBe('Plain string title');
  });

  it('readTextNode: falls back to "Manual topic" when title produces empty string', () => {
    const result = normalizeMerckSearchPayload(
      {
        feed: {
          id: 'feed-1',
          updated: '2026-01-01T00:00:00Z',
          entry: [
            {
              id: 'e1',
              title: {'#text': ''},
              summary: '',
              updated: '2026-01-01T00:00:00Z',
              link: {'@href': 'https://www.msdvetmanual.com/topic'},
            },
          ],
        },
      },
      {language: 'en', media: 'hybrid'},
    );

    expect(result.entries[0].title).toBe('Manual topic');
  });

  it('isAllowedMerckUrl: allows subdomain of allowed host', () => {
    expect(isAllowedMerckUrl('https://www.merckvetmanual.com/dogs')).toBe(true);
  });

  it('isAllowedMerckUrl: rejects invalid URLs', () => {
    expect(isAllowedMerckUrl('not-a-url')).toBe(false);
  });
});
