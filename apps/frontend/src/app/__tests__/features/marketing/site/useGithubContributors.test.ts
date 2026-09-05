import { renderHook, waitFor } from '@testing-library/react';
import { useGithubContributors } from '@/app/features/marketing/site/useGithubContributors';

type FetchLike = typeof fetch;

const originalFetch = globalThis.fetch;

const response = (data: unknown, ok = true) =>
  ({
    ok,
    json: () => Promise.resolve(data),
  }) as unknown as Response;

describe('useGithubContributors', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses live contributors, filters bots, and falls back to a GitHub profile URL', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(
        response([
          {
            login: 'ada',
            avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
            html_url: 'https://github.com/ada',
            type: 'User',
          },
          {
            login: 'grace',
            avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4',
            type: 'User',
          },
          {
            login: 'a-bot',
            avatar_url: 'https://avatars.githubusercontent.com/u/3?v=4',
            html_url: 'https://github.com/a-bot',
            type: 'Bot',
          },
        ])
      )
    ) as unknown as FetchLike;

    const { result } = renderHook(() => useGithubContributors());

    await waitFor(() =>
      expect(result.current?.map((contributor) => contributor.login)).toEqual(['ada', 'grace'])
    );
    expect(result.current?.[0]).toEqual({
      login: 'ada',
      avatarSrc: 'https://avatars.githubusercontent.com/u/1?v=4',
      href: 'https://github.com/ada',
    });
    expect(result.current?.[1]).toEqual({
      login: 'grace',
      avatarSrc: 'https://avatars.githubusercontent.com/u/2?v=4',
      href: 'https://github.com/grace',
    });
  });

  it('filters bot logins GitHub still types as users, and entries with no login', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(
        response([
          {
            login: 'turbobot-temp',
            avatar_url: 'https://avatars.githubusercontent.com/u/4?v=4',
            html_url: 'https://github.com/turbobot-temp',
            type: 'User',
          },
          {
            login: 'dependabot[bot]',
            avatar_url: 'https://avatars.githubusercontent.com/u/5?v=4',
            html_url: 'https://github.com/apps/dependabot',
            type: 'User',
          },
          {
            avatar_url: 'https://avatars.githubusercontent.com/u/6?v=4',
            html_url: 'https://github.com/anon',
            type: 'User',
          },
          {
            login: 'ada',
            avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
            html_url: 'https://github.com/ada',
            type: 'User',
          },
        ])
      )
    ) as unknown as FetchLike;

    const { result } = renderHook(() => useGithubContributors());

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.map((contributor) => contributor.login)).toEqual(['ada']);
  });

  it('stays null when the response is not ok', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(response(null, false))
    ) as unknown as FetchLike;

    const { result } = renderHook(() => useGithubContributors());

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('stays null when fetch rejects', async () => {
    globalThis.fetch = jest.fn(() => Promise.reject(new Error('network'))) as unknown as FetchLike;

    const { result } = renderHook(() => useGithubContributors());

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});
