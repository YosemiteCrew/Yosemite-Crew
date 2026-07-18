import { renderHook, waitFor } from '@testing-library/react';
import {
  useGithubStats,
  useLatestRelease,
  useMobileRelease,
} from '@/app/features/marketing/site/useGithubStats';

type FetchLike = typeof fetch;

const makeRes = (data: unknown, link?: string) =>
  ({
    ok: true,
    json: () => Promise.resolve(data),
    headers: { get: (h: string) => (h === 'Link' ? (link ?? '') : null) },
  }) as unknown as Response;

const notOk = () =>
  ({
    ok: false,
    json: () => Promise.resolve(null),
    headers: { get: () => null },
  }) as unknown as Response;

describe('useGithubStats hooks', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('resolves stars, self-hosters, contributors and discord', async () => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/releases')) return Promise.resolve(makeRes([]));
      if (url.includes('summary.json'))
        return Promise.resolve(makeRes({ clones: { total: 67134 } }));
      if (url.includes('contributors'))
        return Promise.resolve(makeRes([], '<u&page=58>; rel="last"'));
      if (url.includes('/invites/'))
        return Promise.resolve(makeRes({ approximate_member_count: 3210 }));
      if (url.endsWith('/Yosemite-Crew'))
        return Promise.resolve(makeRes({ stargazers_count: 2431 }));
      return Promise.resolve(makeRes(null));
    }) as unknown as FetchLike;

    const { result } = renderHook(() => useGithubStats());
    await waitFor(() => expect(result.current.stars).toBe('2.4k'));
    expect(result.current.starsFull).toBe('2,431');
    await waitFor(() => expect(result.current.selfHosters).toBe('67,134'));
    await waitFor(() => expect(result.current.contributors).toBe('58'));
    await waitFor(() => expect(result.current.discord).toBe('3,210'));
  });

  it('skips the network entirely when the session cache is still fresh', () => {
    const fetchMock = jest.fn(() => Promise.resolve(makeRes(null)));
    globalThis.fetch = fetchMock as unknown as FetchLike;
    sessionStorage.setItem(
      'yc_marketing_stats_v1',
      JSON.stringify({
        stars: '9k',
        starsFull: '9,000',
        selfHosters: '70,000',
        contributors: '60',
        discord: '4,000',
      })
    );
    sessionStorage.setItem('yc_marketing_stats_ts_v1', String(Date.now()));

    const { result } = renderHook(() => useGithubStats());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.stars).toBe('9k');
    expect(result.current.contributors).toBe('60');
  });

  it('refetches on mount in live mode even when the session cache is still fresh', async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('summary.json'))
        return Promise.resolve(makeRes({ clones: { total: 67134 } }));
      if (url.includes('contributors'))
        return Promise.resolve(makeRes([], '<u&page=58>; rel="last"'));
      if (url.includes('/invites/'))
        return Promise.resolve(makeRes({ approximate_member_count: 3210 }));
      if (url.endsWith('/Yosemite-Crew'))
        return Promise.resolve(makeRes({ stargazers_count: 2431 }));
      return Promise.resolve(makeRes(null));
    });
    globalThis.fetch = fetchMock as unknown as FetchLike;
    sessionStorage.setItem(
      'yc_marketing_stats_v1',
      JSON.stringify({
        stars: '9k',
        starsFull: '9,000',
        selfHosters: '70,000',
        contributors: '60',
        discord: '4,000',
      })
    );
    sessionStorage.setItem('yc_marketing_stats_ts_v1', String(Date.now()));

    const { result } = renderHook(() => useGithubStats({ live: true }));

    // Unlike the default hook, live mode ignores the fresh cache and hits the network,
    // so the live numbers replace the seeded cached ones.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(result.current.starsFull).toBe('2,431'));
    expect(result.current.selfHosters).toBe('67,134');
  });

  it('fires exactly one round of requests when several instances mount at once', async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('summary.json'))
        return Promise.resolve(makeRes({ clones: { total: 67134 } }));
      if (url.includes('contributors'))
        return Promise.resolve(makeRes([], '<u&page=58>; rel="last"'));
      if (url.includes('/invites/'))
        return Promise.resolve(makeRes({ approximate_member_count: 3210 }));
      if (url.endsWith('/Yosemite-Crew'))
        return Promise.resolve(makeRes({ stargazers_count: 2431 }));
      return Promise.resolve(makeRes(null));
    });
    globalThis.fetch = fetchMock as unknown as FetchLike;

    const { result } = renderHook(() => {
      useGithubStats();
      useGithubStats();
      return useGithubStats();
    });

    await waitFor(() => expect(result.current.stars).toBe('2.4k'));

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    const countIncluding = (needle: string) => urls.filter((u) => u.includes(needle)).length;
    expect(urls.filter((u) => u.endsWith('/Yosemite-Crew')).length).toBe(1);
    expect(countIncluding('summary.json')).toBe(1);
    expect(countIncluding('contributors')).toBe(1);
    expect(countIncluding('/invites/')).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    expect(result.current.selfHosters).toBe('67,134');
    expect(result.current.contributors).toBe('58');
    expect(result.current.discord).toBe('3,210');
  });

  it('reads self-hosters from the chart dataset shape', async () => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('summary.json')) {
        return Promise.resolve(
          makeRes({
            charts: {
              '#clones_total': { datasets: { a: [{ clones_total: 40 }, { clones_total: 27 }] } },
            },
          })
        );
      }
      return Promise.resolve(notOk());
    }) as unknown as FetchLike;
    const { result } = renderHook(() => useGithubStats());
    await waitFor(() => expect(result.current.selfHosters).toBe('67'));
  });

  it('falls back to the default self-hoster count when the report is unavailable', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve(notOk())) as unknown as FetchLike;
    const { result } = renderHook(() => useGithubStats());
    await waitFor(() => expect(result.current.selfHosters).toBe('67,100'));
  });

  it('resolves the latest platform release and strips the tag prefix', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(
        makeRes({
          tag_name: 'backend-v2.0.0-beta',
          published_at: '2026-07-02T00:00:00Z',
          html_url: 'https://example.test/rel',
        })
      )
    ) as unknown as FetchLike;
    const { result } = renderHook(() => useLatestRelease());
    await waitFor(() => expect(result.current.tag).toBe('v2.0.0-beta'));
    expect(result.current.url).toBe('https://example.test/rel');
    expect(result.current.date).toContain('2026');
  });

  it('resolves the newest mobile release from the releases list', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(
        makeRes([
          {
            tag_name: 'backend-v2',
            name: 'backend',
            published_at: '2026-01-01T00:00:00Z',
            html_url: 'https://x/b',
          },
          {
            tag_name: 'mobile-v1.2',
            name: 'Yosemite mobile beta',
            published_at: '2026-06-30T00:00:00Z',
            html_url: 'https://x/m',
          },
        ])
      )
    ) as unknown as FetchLike;
    const { result } = renderHook(() => useMobileRelease());
    await waitFor(() => expect(result.current.url).toBe('https://x/m'));
    // The version comes from tag_name (-> 'v1.2'), never the free-form release name.
    expect(result.current.tag).toBe('v1.2');
  });

  it('falls back to the default count when every request rejects', async () => {
    // Every fetch throwing exercises the fetchJson and fetchContributors catch paths.
    globalThis.fetch = jest.fn(() => Promise.reject(new Error('network'))) as unknown as FetchLike;
    const { result } = renderHook(() => useGithubStats());
    await waitFor(() => expect(result.current.selfHosters).toBe('67,100'));
    expect(result.current.contributors).toBeNull();
    expect(result.current.stars).toBeNull();
  });

  it('falls back when the summary has neither a clones total nor a chart dataset', async () => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('summary.json')) return Promise.resolve(makeRes({}));
      return Promise.resolve(notOk());
    }) as unknown as FetchLike;
    const { result } = renderHook(() => useGithubStats());
    await waitFor(() => expect(result.current.selfHosters).toBe('67,100'));
  });

  it('seeds the platform release from the session cache before the network answers', async () => {
    sessionStorage.setItem(
      'yc_rel_platform_v1',
      JSON.stringify({ tag: 'v9.9.9', date: 'Jan 1, 2026', url: 'https://x/cached' })
    );
    // A tag-less response leaves the seeded cache in place.
    globalThis.fetch = jest.fn(() => Promise.resolve(makeRes(null))) as unknown as FetchLike;
    const { result } = renderHook(() => useLatestRelease());
    await waitFor(() => expect(result.current.tag).toBe('v9.9.9'));
    expect(result.current.url).toBe('https://x/cached');
  });

  it('in live mode refetches and shows the live release, ignoring the cache', async () => {
    sessionStorage.setItem(
      'yc_rel_platform_v1',
      JSON.stringify({ tag: 'v9.9.9', date: 'Jan 1, 2026', url: 'https://x/cached' })
    );
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(
        makeRes({
          tag_name: 'backend-v3.0.0',
          published_at: '2026-07-02T00:00:00Z',
          html_url: 'https://x/live',
        })
      )
    ) as unknown as FetchLike;
    const { result } = renderHook(() => useLatestRelease({ live: true }));
    await waitFor(() => expect(result.current.tag).toBe('v3.0.0'));
    expect(result.current.url).toBe('https://x/live');
  });

  it('in live mode never paints the cached release when the fetch yields nothing', async () => {
    sessionStorage.setItem(
      'yc_rel_platform_v1',
      JSON.stringify({ tag: 'v9.9.9', date: 'Jan 1, 2026', url: 'https://x/cached' })
    );
    // A tag-less response would keep a seeded cache; live mode skips the seed, so the
    // card stays on its loading placeholder rather than showing stale-as-live.
    globalThis.fetch = jest.fn(() => Promise.resolve(makeRes(null))) as unknown as FetchLike;
    const { result } = renderHook(() => useLatestRelease({ live: true }));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(result.current.tag).toBeNull();
    expect(result.current.url).toBeNull();
  });

  it('seeds the mobile release from cache and keeps it when no release tag is mobile', async () => {
    sessionStorage.setItem(
      'yc_rel_mobile_v1',
      JSON.stringify({ tag: 'm9.9', date: 'Jan 1, 2026', url: 'https://x/cached-m' })
    );
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(makeRes([{ tag_name: 'backend-v2', html_url: 'https://x/b' }]))
    ) as unknown as FetchLike;
    const { result } = renderHook(() => useMobileRelease());
    await waitFor(() => expect(result.current.tag).toBe('m9.9'));
    expect(result.current.url).toBe('https://x/cached-m');
  });
});
