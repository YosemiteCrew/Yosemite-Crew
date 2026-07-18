import { renderHook, waitFor } from '@testing-library/react';
import { useRepoInsights } from '@/app/features/marketing/site/useRepoInsights';

type FetchLike = typeof fetch;

const res = (data: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  }) as unknown as Response;

describe('useRepoInsights', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('parses repo facts, languages, commits, contributors and the heartbeat', async () => {
    const now = new Date().toISOString();
    globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/languages')) {
        return Promise.resolve(res({ TypeScript: 8000, CSS: 2000 }));
      }
      if (url.includes('/commits')) {
        return Promise.resolve(
          res([
            {
              sha: 'abcdef1234567',
              html_url: 'https://gh/commit/1',
              commit: {
                message: 'feat: add insights\n\ndetails',
                author: { name: 'Ada', date: now },
              },
              author: { login: 'ada', avatar_url: 'https://av/ada.png' },
            },
          ])
        );
      }
      if (url.includes('/contributors')) {
        return Promise.resolve(
          res([
            {
              login: 'ada',
              avatar_url: 'https://av/ada.png',
              html_url: 'https://gh/ada',
              type: 'User',
            },
            { login: 'a-bot', avatar_url: 'x', html_url: 'y', type: 'Bot' },
          ])
        );
      }
      if (url.includes('/stats/commit_activity')) {
        return Promise.resolve(res([{ total: 3 }, { total: 9 }]));
      }
      if (url.endsWith('/Yosemite-Crew')) {
        return Promise.resolve(
          res({
            forks_count: 128,
            open_issues_count: 12,
            subscribers_count: 34,
            pushed_at: now,
            license: { spdx_id: 'AGPL-3.0' },
          })
        );
      }
      return Promise.resolve(res(null));
    }) as unknown as FetchLike;

    const { result } = renderHook(() => useRepoInsights());

    await waitFor(() => expect(result.current.facts?.forks).toBe('128'));
    expect(result.current.forks).toBe('128');
    expect(result.current.facts?.license).toBe('AGPL-3.0');
    expect(result.current.facts?.issues).toBe('12');

    await waitFor(() => expect(result.current.languages?.[0].name).toBe('TypeScript'));
    expect(result.current.languages?.[0].color).toBe('#257bed');
    expect(Math.round(result.current.languages?.[0].pct ?? 0)).toBe(80);

    await waitFor(() => expect(result.current.commits?.[0].message).toBe('feat: add insights'));
    expect(result.current.commits?.[0].sha).toBe('abcdef1');
    expect(result.current.commits?.[0].login).toBe('ada');

    // Bots are filtered out of the contributor list.
    await waitFor(() => expect(result.current.contributors?.map((c) => c.login)).toEqual(['ada']));

    await waitFor(() => expect(result.current.heartbeat).toEqual([3, 9]));
  });

  it('stays null-safe when every request fails', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve(res(null, 500))) as unknown as FetchLike;

    const { result } = renderHook(() => useRepoInsights());

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(result.current.facts).toBeNull();
    expect(result.current.languages).toBeNull();
    expect(result.current.commits).toBeNull();
    expect(result.current.contributors).toBeNull();
    expect(result.current.heartbeat).toBeNull();
  });

  it('parses languages, varied commit ages, contributor limits and a NOASSERTION license', async () => {
    const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
    globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/languages')) {
        // 7 languages -> top 6 plus an "Other" bucket; Rust/Go/Nim/Zig/Crystal
        // are not in the colour map, exercising the fallback palette.
        return Promise.resolve(
          res({
            TypeScript: 5000,
            Rust: 3000,
            Go: 1000,
            Nim: 800,
            Zig: 600,
            Crystal: 400,
            Haxe: 200,
          })
        );
      }
      if (url.includes('/commits')) {
        return Promise.resolve(
          res([
            {
              sha: 'aaaaaaa1',
              html_url: '#',
              commit: { message: 'm-min', author: { name: 'A', date: ago(5 * 60 * 1000) } },
              author: { login: 'a', avatar_url: 'av' },
            },
            {
              sha: 'bbbbbbb1',
              html_url: '#',
              commit: { message: 'm-hr', author: { date: ago(2 * 3600 * 1000) } },
              author: { login: 'b' },
            },
            {
              sha: 'ccccccc1',
              html_url: '#',
              commit: { message: 'm-day', author: { name: 'C', date: ago(3 * 86400 * 1000) } },
            },
            {
              sha: 'ddddddd1',
              html_url: '#',
              commit: { message: 'm-mo', author: { date: ago(40 * 86400 * 1000) } },
              author: { login: 'd' },
            },
            {
              sha: 'eeeeeee1',
              html_url: '#',
              commit: { message: 'm-yr', author: { date: ago(400 * 86400 * 1000) } },
              author: { login: 'e' },
            },
          ])
        );
      }
      if (url.includes('/contributors')) {
        return Promise.resolve(
          res(
            Array.from({ length: 12 }, (_, i) => ({
              login: `u${i}`,
              avatar_url: 'a',
              html_url: 'h',
              type: 'User',
            }))
          )
        );
      }
      if (url.includes('/stats/commit_activity')) return Promise.resolve(res([]));
      if (url.endsWith('/Yosemite-Crew')) {
        return Promise.resolve(
          res({
            forks_count: 2500,
            subscribers_count: 1200,
            pushed_at: ago(45 * 1000),
            license: { spdx_id: 'NOASSERTION', name: 'Custom License' },
          })
        );
      }
      return Promise.resolve(res(null));
    }) as unknown as FetchLike;

    const { result } = renderHook(() => useRepoInsights());

    await waitFor(() => expect(result.current.languages?.length).toBe(7));
    expect(result.current.languages?.some((l) => l.name === 'Other')).toBe(true);
    expect(result.current.languages?.find((l) => l.name === 'Rust')?.color).toMatch(
      /^#[0-9a-f]{6}$/i
    );

    await waitFor(() => expect(result.current.commits?.length).toBe(5));
    expect(result.current.commits?.[0].when).toMatch(/m ago/);
    expect(result.current.commits?.[1].avatar).toBeNull();
    expect(result.current.commits?.[2].login).toBe('C');
    expect(result.current.commits?.[3].when).toMatch(/mo ago/);
    expect(result.current.commits?.[4].when).toMatch(/y ago/);

    await waitFor(() => expect(result.current.contributors?.length).toBe(9));
    await waitFor(() => expect(result.current.facts?.forks).toBe('2.5k'));
    expect(result.current.facts?.issues).toBe('—');
    expect(result.current.facts?.watching).toBe('1.2k');
    expect(result.current.facts?.license).toBe('Custom License');
    expect(result.current.facts?.lastPush).toBe('just now');
    expect(result.current.heartbeat).toBeNull();
  });

  it('falls back to AGPL-3.0, drops a failed section and blanks a dateless commit', async () => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/languages')) return Promise.reject(new Error('network'));
      if (url.includes('/commits')) {
        return Promise.resolve(
          res([{ sha: 'nodate1', html_url: '#', commit: { message: 'no date' } }])
        );
      }
      if (url.includes('/contributors')) return Promise.resolve(res(null));
      if (url.includes('/stats/commit_activity')) return Promise.reject(new Error('boom'));
      if (url.endsWith('/Yosemite-Crew'))
        return Promise.resolve(res({ forks_count: 0, license: null }));
      return Promise.resolve(res(null));
    }) as unknown as FetchLike;

    const { result } = renderHook(() => useRepoInsights());

    await waitFor(() => expect(result.current.facts?.license).toBe('AGPL-3.0'));
    expect(result.current.languages).toBeNull();
    expect(result.current.commits?.[0].when).toBe('');
    expect(result.current.commits?.[0].login).toBe('unknown');
  });

  it('applies safe fallbacks for missing commit, contributor and heartbeat fields', async () => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/languages')) return Promise.resolve(res({}));
      if (url.includes('/commits')) return Promise.resolve(res([{}]));
      if (url.includes('/contributors')) return Promise.resolve(res([{ login: 'z' }]));
      if (url.includes('/stats/commit_activity')) return Promise.resolve(res([{}, { total: 5 }]));
      if (url.endsWith('/Yosemite-Crew')) return Promise.resolve(res({ forks_count: 3 }));
      return Promise.resolve(res(null));
    }) as unknown as FetchLike;

    const { result } = renderHook(() => useRepoInsights());

    await waitFor(() => expect(result.current.commits?.length).toBe(1));
    expect(result.current.commits?.[0]).toMatchObject({
      message: '',
      sha: '',
      url: '#',
      login: 'unknown',
      when: '',
      avatar: null,
    });
    await waitFor(() =>
      expect(result.current.contributors?.[0]).toEqual({ login: 'z', avatar: '', url: '#' })
    );
    await waitFor(() => expect(result.current.heartbeat).toEqual([0, 5]));
  });

  it('retries the heartbeat after a 202 and then renders the weeks', async () => {
    // Real timers: the source waits ~1.6s between attempts, and the follow-up
    // setData must land inside waitFor's act() wrapper (fake timers fire it outside).
    let activityCalls = 0;
    globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/stats/commit_activity')) {
        activityCalls += 1;
        return Promise.resolve(
          activityCalls === 1 ? res(null, 202) : res([{ total: 4 }, { total: 8 }])
        );
      }
      return Promise.resolve(res(null));
    }) as unknown as FetchLike;

    const { result } = renderHook(() => useRepoInsights());

    await waitFor(() => expect(result.current.heartbeat).toEqual([4, 8]), { timeout: 4000 });
    expect(activityCalls).toBe(2);
  });
});
