import { fetchOverviewSources } from '../../../../features/overview/hooks/overviewStatsSources';

globalThis.fetch = jest.fn();

const fetchMock = globalThis.fetch as jest.Mock;

const SUMMARY_URL =
  'https://raw.githubusercontent.com/YosemiteCrew/Yosemite-Crew/github-repo-stats/YosemiteCrew/Yosemite-Crew/latest-report/summary.json';

describe('fetchOverviewSources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1234567890);
  });

  afterAll(() => {
    (Date.now as jest.Mock).mockRestore();
  });

  it('returns all three payloads and cache-busts the summary read', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ charts: {} }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ stargazers_count: 2200 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 1 }] });

    await expect(fetchOverviewSources()).resolves.toEqual({
      json: { charts: {} },
      repoJson: { stargazers_count: 2200 },
      contributorsJson: [{ id: 1 }],
    });

    expect(fetchMock).toHaveBeenCalledWith(`${SUMMARY_URL}?t=1234567890`, { cache: 'no-store' });
  });

  it('degrades the two GitHub reads when they are refused', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ charts: {} }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'rate limited' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'rate limited' }) });

    const sources = await fetchOverviewSources();

    expect(sources.repoJson).toBeNull();
    expect(sources.contributorsJson).toEqual([]);
    expect(sources.json).toEqual({ charts: {} });
  });

  it('rejects when the summary read fails', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    await expect(fetchOverviewSources()).rejects.toThrow('Failed to load repo stats');
  });
});
