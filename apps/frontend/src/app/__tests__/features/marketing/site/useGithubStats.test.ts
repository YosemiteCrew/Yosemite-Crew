import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { renderHook, waitFor } from '@testing-library/react';
import {
  useGithubStats,
  useLatestRelease,
  useMobileRelease,
  usePlatformRelease,
  type GithubStats,
  type ReleaseInfo,
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

const DISCORD_ENDPOINT = '/api/community/discord-members';
const GITHUB_STATS_ENDPOINT = '/api/community/github-stats';

/**
 * Stars, self-hosters and contributors are now resolved server-side by the
 * github-stats route handler and arrive as one payload, so tests stub that
 * endpoint rather than the three upstream URLs. The upstream parsing those URLs
 * needed is covered by the route handler's own test.
 */
const statsResponse = (stats: Partial<GithubStats>) => makeRes(stats);

/**
 * Member count served by the same-origin Discord route for the current test.
 * Discord is read through plain `fetch` like every other stat, so tests wrap
 * their handler in `withDiscord` and set this instead of mocking a client.
 */
let discordMembers: string | null = null;

const withDiscord = (handler: (url: string) => Promise<Response>) =>
  jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes(DISCORD_ENDPOINT)) return Promise.resolve(makeRes({ discordMembers }));
    return handler(url);
  });

describe('useGithubStats hooks', () => {
  beforeEach(() => {
    sessionStorage.clear();
    discordMembers = null;
  });

  it('resolves stars, self-hosters, contributors and discord', async () => {
    discordMembers = '3,210';
    globalThis.fetch = withDiscord((url) => {
      if (url.includes('/releases')) return Promise.resolve(makeRes([]));
      if (url.includes(GITHUB_STATS_ENDPOINT))
        return Promise.resolve(
          statsResponse({
            stars: '2.4k',
            starsFull: '2,431',
            selfHosters: '67,134',
            contributors: '58',
          })
        );
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

  it('server-renders the loading placeholders even when the session cache is seeded', () => {
    sessionStorage.setItem('yc_marketing_stats_v1', JSON.stringify({ stars: '9k' }));
    sessionStorage.setItem(
      'yc_rel_platform_v1',
      JSON.stringify({ tag: 'v9.9.9', date: 'Jan 1, 2026', url: 'https://x/cached' })
    );
    let stats: GithubStats | null = null;
    let release: ReleaseInfo | null = null;
    let mobile: ReleaseInfo | null = null;
    const Probe = () => {
      stats = useGithubStats();
      release = useLatestRelease();
      mobile = useMobileRelease();
      return null;
    };
    renderToString(createElement(Probe));
    expect(stats!.stars).toBeNull();
    expect(release!.tag).toBeNull();
    expect(mobile!.tag).toBeNull();
  });

  it('treats a corrupt session cache entry as the empty placeholders', async () => {
    sessionStorage.setItem('yc_marketing_stats_v1', '{not json');
    globalThis.fetch = jest.fn(() => Promise.resolve(notOk())) as unknown as FetchLike;
    const { result } = renderHook(() => useGithubStats());
    expect(result.current.stars).toBeNull();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(result.current.stars).toBeNull();
  });

  it('refetches when the session cache is fresh but discord is still missing', async () => {
    discordMembers = '196';
    const fetchMock = withDiscord((url) => {
      if (url.includes(GITHUB_STATS_ENDPOINT))
        return Promise.resolve(
          statsResponse({
            stars: '2.4k',
            starsFull: '2,431',
            selfHosters: '67,134',
            contributors: '58',
          })
        );
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
        discord: null,
      })
    );
    sessionStorage.setItem('yc_marketing_stats_ts_v1', String(Date.now()));

    const { result } = renderHook(() => useGithubStats());

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(result.current.discord).toBe('196'));
    expect(result.current.stars).toBe('2.4k');
    expect(result.current.contributors).toBe('58');
  });

  it('refetches on mount in live mode even when the session cache is still fresh', async () => {
    discordMembers = '3,210';
    const fetchMock = withDiscord((url) => {
      if (url.includes(GITHUB_STATS_ENDPOINT))
        return Promise.resolve(
          statsResponse({
            stars: '2.4k',
            starsFull: '2,431',
            selfHosters: '67,134',
            contributors: '58',
          })
        );
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

  it('in live mode shows placeholders for failed fetchers, never cached or fabricated values', async () => {
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
    discordMembers = '3,210';
    // Every other endpoint fails: stars, the self-hoster report, and contributors.
    globalThis.fetch = withDiscord(() => Promise.resolve(notOk())) as unknown as FetchLike;

    const { result } = renderHook(() => useGithubStats({ live: true }));

    // Only Discord resolved; it shows its live value.
    await waitFor(() => expect(result.current.discord).toBe('3,210'));
    // Every failed fetcher shows the placeholder, never the seeded cache value and
    // never a hard-coded self-hoster constant.
    expect(result.current.stars).toBeNull();
    expect(result.current.starsFull).toBeNull();
    expect(result.current.contributors).toBeNull();
    expect(result.current.selfHosters).toBeNull();
  });

  it('fires exactly one round of requests when several instances mount at once', async () => {
    discordMembers = '3,210';
    const fetchMock = withDiscord((url) => {
      if (url.includes(GITHUB_STATS_ENDPOINT))
        return Promise.resolve(
          statsResponse({
            stars: '2.4k',
            starsFull: '2,431',
            selfHosters: '67,134',
            contributors: '58',
          })
        );
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
    // Three mounts, and the browser makes two same-origin requests in total: the
    // three GitHub lookups are now one server-side call.
    expect(countIncluding(GITHUB_STATS_ENDPOINT)).toBe(1);
    expect(countIncluding(DISCORD_ENDPOINT)).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(result.current.selfHosters).toBe('67,134');
    expect(result.current.contributors).toBe('58');
    expect(result.current.discord).toBe('3,210');
  });

  it('surfaces the self-hoster count the stats route returns', async () => {
    // Parsing the upstream clone-traffic report is the route handler's job now
    // and is covered by its own test; the hook just surfaces the value.
    globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes(GITHUB_STATS_ENDPOINT)) {
        return Promise.resolve(statsResponse({ selfHosters: '67' }));
      }
      return Promise.resolve(notOk());
    }) as unknown as FetchLike;
    const { result } = renderHook(() => useGithubStats());
    await waitFor(() => expect(result.current.selfHosters).toBe('67'));
  });

  it('shows no self-hoster count (placeholder) when the report is unavailable', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve(notOk())) as unknown as FetchLike;
    const { result } = renderHook(() => useGithubStats());
    // No hard-coded fallback: a failed report leaves the placeholder, never a fake number.
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(result.current.selfHosters).toBeNull();
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

  it('resolves the newest platform (PIMS) release from the releases list, not the desktop build', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(
        makeRes([
          {
            tag_name: 'desktop-v0.1.0-beta.2',
            name: 'Desktop',
            published_at: '2026-07-13T13:33:54Z',
            html_url: 'https://x/desktop',
          },
          {
            tag_name: 'pims-v2.2.0-beta',
            name: 'PIMS v2.2.0-beta',
            published_at: '2026-08-06T13:33:55Z',
            html_url: 'https://x/pims',
          },
          {
            tag_name: 'pims-v2.0.0-beta',
            name: 'PIMS v2.0.0-beta',
            published_at: '2026-07-02T00:00:00Z',
            html_url: 'https://x/pims-old',
          },
        ])
      )
    ) as unknown as FetchLike;
    const { result } = renderHook(() => usePlatformRelease());
    // Picks the newest pims-tagged release (list is newest-first), never the desktop build.
    await waitFor(() => expect(result.current.url).toBe('https://x/pims'));
    expect(result.current.tag).toBe('v2.2.0-beta');
    expect(result.current.date).toContain('2026');
  });

  it('yields no stats (all placeholders) when every request rejects', async () => {
    // Every fetch throwing exercises the fetchJson and fetchContributors catch paths.
    globalThis.fetch = jest.fn(() => Promise.reject(new Error('network'))) as unknown as FetchLike;
    const { result } = renderHook(() => useGithubStats());
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(result.current.selfHosters).toBeNull();
    expect(result.current.contributors).toBeNull();
    expect(result.current.stars).toBeNull();
  });

  it('shows no self-hoster count when the summary lacks a clones total or chart dataset', async () => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('summary.json')) return Promise.resolve(makeRes({}));
      return Promise.resolve(notOk());
    }) as unknown as FetchLike;
    const { result } = renderHook(() => useGithubStats());
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(result.current.selfHosters).toBeNull();
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
