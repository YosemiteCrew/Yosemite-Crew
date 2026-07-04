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
            name: 'mobile 1.2',
            published_at: '2026-06-30T00:00:00Z',
            html_url: 'https://x/m',
          },
        ])
      )
    ) as unknown as FetchLike;
    const { result } = renderHook(() => useMobileRelease());
    await waitFor(() => expect(result.current.url).toBe('https://x/m'));
  });
});
