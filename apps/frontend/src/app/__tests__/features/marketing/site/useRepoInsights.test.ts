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
});
