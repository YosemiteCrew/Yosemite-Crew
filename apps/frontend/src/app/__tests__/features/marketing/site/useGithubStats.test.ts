import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { renderHook, waitFor } from '@testing-library/react';
import {
  useGithubStats,
  useLatestRelease,
  useMobileRelease,
  usePlatformRelease,
  useReleaseLanes,
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
 * Stars, repository clones and contributors are now resolved server-side by the
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

  it('resolves stars, repository clones, contributors and discord', async () => {
    discordMembers = '3,210';
    globalThis.fetch = withDiscord((url) => {
      if (url.includes('/releases')) return Promise.resolve(makeRes([]));
      if (url.includes(GITHUB_STATS_ENDPOINT))
        return Promise.resolve(
          statsResponse({
            stars: '2.4k',
            starsFull: '2,431',
            repositoryClones: '67,134',
            contributors: '58',
          })
        );
      return Promise.resolve(makeRes(null));
    }) as unknown as FetchLike;

    const { result } = renderHook(() => useGithubStats());
    await waitFor(() => expect(result.current.stars).toBe('2.4k'));
    expect(result.current.starsFull).toBe('2,431');
    await waitFor(() => expect(result.current.repositoryClones).toBe('67,134'));
    await waitFor(() => expect(result.current.contributors).toBe('58'));
    await waitFor(() => expect(result.current.discord).toBe('3,210'));
  });

  it('skips the network entirely when the session cache is still fresh', () => {
    const fetchMock = jest.fn(() => Promise.resolve(makeRes(null)));
    globalThis.fetch = fetchMock as unknown as FetchLike;
    sessionStorage.setItem(
      'yc_marketing_stats_v2',
      JSON.stringify({
        stars: '9k',
        starsFull: '9,000',
        repositoryClones: '70,000',
        contributors: '60',
        discord: '4,000',
      })
    );
    sessionStorage.setItem('yc_marketing_stats_ts_v2', String(Date.now()));

    const { result } = renderHook(() => useGithubStats());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.stars).toBe('9k');
    expect(result.current.contributors).toBe('60');
  });

  it('server-renders the loading placeholders even when the session cache is seeded', () => {
    sessionStorage.setItem('yc_marketing_stats_v2', JSON.stringify({ stars: '9k' }));
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
    sessionStorage.setItem('yc_marketing_stats_v2', '{not json');
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
            repositoryClones: '67,134',
            contributors: '58',
          })
        );
      return Promise.resolve(makeRes(null));
    });
    globalThis.fetch = fetchMock as unknown as FetchLike;
    sessionStorage.setItem(
      'yc_marketing_stats_v2',
      JSON.stringify({
        stars: '9k',
        starsFull: '9,000',
        repositoryClones: '70,000',
        contributors: '60',
        discord: null,
      })
    );
    sessionStorage.setItem('yc_marketing_stats_ts_v2', String(Date.now()));

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
            repositoryClones: '67,134',
            contributors: '58',
          })
        );
      return Promise.resolve(makeRes(null));
    });
    globalThis.fetch = fetchMock as unknown as FetchLike;
    sessionStorage.setItem(
      'yc_marketing_stats_v2',
      JSON.stringify({
        stars: '9k',
        starsFull: '9,000',
        repositoryClones: '70,000',
        contributors: '60',
        discord: '4,000',
      })
    );
    sessionStorage.setItem('yc_marketing_stats_ts_v2', String(Date.now()));

    const { result } = renderHook(() => useGithubStats({ live: true }));

    // Unlike the default hook, live mode ignores the fresh cache and hits the network,
    // so the live numbers replace the seeded cached ones.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(result.current.starsFull).toBe('2,431'));
    expect(result.current.repositoryClones).toBe('67,134');
  });

  it('in live mode shows placeholders for failed fetchers, never cached or fabricated values', async () => {
    sessionStorage.setItem(
      'yc_marketing_stats_v2',
      JSON.stringify({
        stars: '9k',
        starsFull: '9,000',
        repositoryClones: '70,000',
        contributors: '60',
        discord: '4,000',
      })
    );
    sessionStorage.setItem('yc_marketing_stats_ts_v2', String(Date.now()));
    discordMembers = '3,210';
    // Every other endpoint fails: stars, the clone report, and contributors.
    globalThis.fetch = withDiscord(() => Promise.resolve(notOk())) as unknown as FetchLike;

    const { result } = renderHook(() => useGithubStats({ live: true }));

    // Only Discord resolved; it shows its live value.
    await waitFor(() => expect(result.current.discord).toBe('3,210'));
    // Every failed fetcher shows the placeholder, never the seeded cache value and
    // never a hard-coded clone constant.
    expect(result.current.stars).toBeNull();
    expect(result.current.starsFull).toBeNull();
    expect(result.current.contributors).toBeNull();
    expect(result.current.repositoryClones).toBeNull();
  });

  it('fires exactly one round of requests when several instances mount at once', async () => {
    discordMembers = '3,210';
    const fetchMock = withDiscord((url) => {
      if (url.includes(GITHUB_STATS_ENDPOINT))
        return Promise.resolve(
          statsResponse({
            stars: '2.4k',
            starsFull: '2,431',
            repositoryClones: '67,134',
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

    expect(result.current.repositoryClones).toBe('67,134');
    expect(result.current.contributors).toBe('58');
    expect(result.current.discord).toBe('3,210');
  });

  it('surfaces the clone count the stats route returns', async () => {
    // Parsing the upstream clone-traffic report is the route handler's job now
    // and is covered by its own test; the hook just surfaces the value.
    globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes(GITHUB_STATS_ENDPOINT)) {
        return Promise.resolve(statsResponse({ repositoryClones: '67' }));
      }
      return Promise.resolve(notOk());
    }) as unknown as FetchLike;
    const { result } = renderHook(() => useGithubStats());
    await waitFor(() => expect(result.current.repositoryClones).toBe('67'));
  });

  it('shows no clone count (placeholder) when the report is unavailable', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve(notOk())) as unknown as FetchLike;
    const { result } = renderHook(() => useGithubStats());
    // No hard-coded fallback: a failed report leaves the placeholder, never a fake number.
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(result.current.repositoryClones).toBeNull();
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
    expect(result.current.repositoryClones).toBeNull();
    expect(result.current.contributors).toBeNull();
    expect(result.current.stars).toBeNull();
  });

  it('shows no clone count when the summary lacks a clones total or chart dataset', async () => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('summary.json')) return Promise.resolve(makeRes({}));
      return Promise.resolve(notOk());
    }) as unknown as FetchLike;
    const { result } = renderHook(() => useGithubStats());
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(result.current.repositoryClones).toBeNull();
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

describe('useReleaseLanes', () => {
  const THIS_YEAR = new Date().getFullYear();

  /** Mirrors the real tag shapes documented in RELEASING.md, newest-first as GitHub returns them. */
  const RELEASES = [
    {
      tag_name: 'mobile-v1.6.1',
      published_at: `${THIS_YEAR}-08-21T10:00:00Z`,
      html_url: 'https://x/mobile',
    },
    {
      tag_name: 'v0.1.0-beta.4',
      published_at: `${THIS_YEAR}-08-19T10:00:00Z`,
      html_url: 'https://x/desktop',
    },
    {
      tag_name: 'backend-v2.3.0-beta',
      published_at: `${THIS_YEAR}-08-19T09:00:00Z`,
      html_url: 'https://x/backend',
    },
    {
      tag_name: 'pims-v2.3.0-beta',
      published_at: `${THIS_YEAR}-08-19T08:00:00Z`,
      html_url: 'https://x/pims',
    },
    {
      tag_name: 'pims-v2.2.0-beta',
      published_at: `${THIS_YEAR}-08-08T08:00:00Z`,
      html_url: 'https://x/pims-old',
    },
  ];

  // The endpoint is `/api/community/github-releases?list=1` - it contains `-releases`, not
  // `/releases`, so match the route name itself.
  const RELEASES_ROUTE = 'github-releases';

  const lanesFetch = (list: unknown[]) =>
    jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes(RELEASES_ROUTE)) return Promise.resolve(makeRes(list));
      return Promise.resolve(makeRes(null));
    });

  beforeEach(() => {
    sessionStorage.clear();
  });

  const byKey = (lanes: ReturnType<typeof useReleaseLanes>, key: string) =>
    lanes.find((lane) => lane.key === key)!;

  it('buckets one releases response into the four shipped lanes', async () => {
    globalThis.fetch = lanesFetch(RELEASES) as unknown as FetchLike;

    const { result } = renderHook(() => useReleaseLanes());
    await waitFor(() => expect(byKey(result.current, 'pims').tag).toBe('v2.3.0-beta'));

    expect(byKey(result.current, 'pims').url).toBe('https://x/pims');
    expect(byKey(result.current, 'mobile').tag).toBe('v1.6.1');
    expect(byKey(result.current, 'backend').tag).toBe('v2.3.0-beta');
    expect(result.current.map((lane) => lane.key)).toEqual([
      'pims',
      'desktop',
      'mobile',
      'backend',
    ]);
  });

  it('claims the unprefixed tag for desktop', async () => {
    // The one that a naive prefix match gets wrong. desktop-release.yml requires the tag to be a
    // bare `v${version}` because electron-updater ignores non-semver tags, so the newest desktop
    // release carries no product prefix at all - and it must not leak into another lane either.
    globalThis.fetch = lanesFetch(RELEASES) as unknown as FetchLike;

    const { result } = renderHook(() => useReleaseLanes());
    await waitFor(() => expect(byKey(result.current, 'desktop').tag).toBe('v0.1.0-beta.4'));

    expect(byKey(result.current, 'desktop').url).toBe('https://x/desktop');
    expect(byKey(result.current, 'pims').tag).not.toBe('v0.1.0-beta.4');
    expect(byKey(result.current, 'mobile').tag).not.toBe('v0.1.0-beta.4');
  });

  it('still matches the legacy pms- spelling and the early desktop- tags', async () => {
    globalThis.fetch = lanesFetch([
      {
        tag_name: 'pms-v1.3.0-beta',
        published_at: `${THIS_YEAR}-05-09T00:00:00Z`,
        html_url: 'https://x/pms',
      },
      {
        tag_name: 'desktop-v0.1.0-beta.2',
        published_at: `${THIS_YEAR}-07-13T00:00:00Z`,
        html_url: 'https://x/dt',
      },
    ]) as unknown as FetchLike;

    const { result } = renderHook(() => useReleaseLanes());
    await waitFor(() => expect(byKey(result.current, 'pims').url).toBe('https://x/pms'));
    expect(byKey(result.current, 'desktop').url).toBe('https://x/dt');
  });

  it('takes the newest release per lane, not the first tag seen', async () => {
    globalThis.fetch = lanesFetch(RELEASES) as unknown as FetchLike;
    const { result } = renderHook(() => useReleaseLanes());
    await waitFor(() => expect(byKey(result.current, 'pims').tag).toBeTruthy());
    // Two pims releases are present; the newer one leads the list and must win.
    expect(byKey(result.current, 'pims').url).toBe('https://x/pims');
  });

  it('leaves a lane null rather than inventing a version for it', async () => {
    // A lane with nothing on the fetched page must show its placeholder. Falling back to a
    // hard-coded version would present a stale literal as a live release.
    globalThis.fetch = lanesFetch([RELEASES[0]]) as unknown as FetchLike;

    const { result } = renderHook(() => useReleaseLanes());
    await waitFor(() => expect(byKey(result.current, 'mobile').tag).toBe('v1.6.1'));

    for (const key of ['pims', 'desktop', 'backend']) {
      expect(byKey(result.current, key).tag).toBeNull();
      expect(byKey(result.current, key).url).toBeNull();
      expect(byKey(result.current, key).dateCompact).toBeNull();
    }
  });

  it('keeps every lane empty when the list is empty or the request fails', async () => {
    globalThis.fetch = lanesFetch([]) as unknown as FetchLike;
    const { result } = renderHook(() => useReleaseLanes());
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(result.current.every((lane) => lane.tag === null)).toBe(true);

    globalThis.fetch = jest.fn(() => Promise.reject(new Error('network'))) as unknown as FetchLike;
    const failed = renderHook(() => useReleaseLanes());
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(failed.result.current.every((lane) => lane.tag === null)).toBe(true);
  });

  it('drops the year from the compact date only within the current year', async () => {
    globalThis.fetch = lanesFetch([
      {
        tag_name: 'mobile-v1.6.1',
        published_at: `${THIS_YEAR}-08-21T10:00:00Z`,
        html_url: 'https://x/m',
      },
      {
        tag_name: 'backend-v1.0.0',
        published_at: `${THIS_YEAR - 2}-03-04T10:00:00Z`,
        html_url: 'https://x/b',
      },
    ]) as unknown as FetchLike;

    const { result } = renderHook(() => useReleaseLanes());
    await waitFor(() => expect(byKey(result.current, 'mobile').dateCompact).toBeTruthy());

    expect(byKey(result.current, 'mobile').dateCompact).toBe('21 Aug');
    // An older release stays unambiguous by carrying a two-digit year.
    expect(byKey(result.current, 'backend').dateCompact).toBe(
      `4 Mar ${String(THIS_YEAR - 2).slice(-2)}`
    );
    // The full date is kept for the accessible name and tooltip.
    expect(byKey(result.current, 'mobile').date).toContain(String(THIS_YEAR));
  });

  it('renders every lane empty on the server', () => {
    const Probe = () => {
      const lanes = useReleaseLanes();
      return createElement('span', null, lanes.map((l) => l.tag ?? '-').join(','));
    };
    expect(renderToString(createElement(Probe))).toContain('-,-,-,-');
  });

  it('still renders the lanes when session storage cannot be written', async () => {
    // Safari private browsing, a blocked third-party context, an exhausted quota.
    // The response already arrived; a failed cache write must not swallow it.
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    try {
      globalThis.fetch = lanesFetch(RELEASES) as unknown as FetchLike;
      const { result } = renderHook(() => useReleaseLanes());
      await waitFor(() => expect(byKey(result.current, 'pims').tag).toBe('v2.3.0-beta'));
      expect(byKey(result.current, 'desktop').tag).toBe('v0.1.0-beta.4');
      expect(sessionStorage.getItem('yc_marketing_release_lanes_v1')).toBeNull();
    } finally {
      setItem.mockRestore();
    }
  });

  it('fetches the releases list once for all four lanes', async () => {
    const spy = lanesFetch(RELEASES);
    globalThis.fetch = spy as unknown as FetchLike;

    const { result } = renderHook(() => useReleaseLanes());
    await waitFor(() => expect(byKey(result.current, 'pims').tag).toBeTruthy());

    const releaseCalls = spy.mock.calls.filter((c) => String(c[0]).includes(RELEASES_ROUTE));
    expect(releaseCalls).toHaveLength(1);
  });
});
