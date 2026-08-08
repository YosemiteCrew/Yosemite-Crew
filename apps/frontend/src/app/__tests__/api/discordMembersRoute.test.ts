/**
 * The route returns a `NextResponse`, which needs the Web `Response` global that
 * the jsdom test environment does not provide. Mocking `next/server` down to the
 * one factory the route uses keeps the whole handler under test - status body and
 * cache headers included - without switching the suite to a node environment
 * (jest.setup.ts touches `HTMLElement`, so it cannot run there).
 */
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { headers?: Record<string, string> }) => ({ body, init }),
  },
}));

type MockedResponse = {
  body: { discordMembers: string | null };
  init?: { headers?: Record<string, string> };
};

type RouteModule = { GET: () => Promise<unknown> };

/**
 * The route keeps a module-level cache of the last successful count, so every
 * test needs its own module instance or one test's cached value answers the
 * next one's request.
 */
const loadRoute = async (): Promise<RouteModule> => {
  let mod: RouteModule | undefined;
  await jest.isolateModulesAsync(async () => {
    mod = (await import('@/app/api/community/discord-members/route')) as RouteModule;
  });
  return mod as RouteModule;
};

const callRoute = async (route: RouteModule): Promise<MockedResponse> =>
  (await route.GET()) as MockedResponse;

const okInvite = (data: unknown) =>
  ({ ok: true, json: () => Promise.resolve(data) }) as unknown as Response;

const notOk = () => ({ ok: false, json: () => Promise.resolve(null) }) as unknown as Response;

const PRIMARY_CODE = 'SwM6mX85KD';
const FALLBACK_CODE = 'yosemitecrew';
const CACHED = 'public, max-age=300, stale-while-revalidate=300';

describe('GET /api/community/discord-members', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the formatted member count from the primary invite code', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okInvite({ approximate_member_count: 1204 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await callRoute(await loadRoute());

    expect(res.body).toEqual({ discordMembers: '1,204' });
    expect(res.init?.headers?.['Cache-Control']).toBe(CACHED);
    // The fallback code is only tried when the first one fails.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(PRIMARY_CODE);
  });

  it('sends the counts query and a descriptive User-Agent Discord accepts', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okInvite({ approximate_member_count: 42 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await callRoute(await loadRoute());

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('with_counts=true');
    expect((init as RequestInit).headers).toMatchObject({
      'User-Agent': expect.stringContaining('yosemitecrew.com'),
    });
  });

  it('never caches the upstream request itself', async () => {
    // Next's data cache keys on the request, not the outcome, so caching here
    // would also cache a 200 that carries no count and replay it for the TTL.
    const fetchMock = jest.fn().mockResolvedValue(okInvite({ approximate_member_count: 5 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await callRoute(await loadRoute());

    const init = fetchMock.mock.calls[0][1] as RequestInit & { next?: unknown };
    expect(init.cache).toBe('no-store');
    expect(init.next).toBeUndefined();
  });

  it('falls back to the second invite code when the first is rejected', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(notOk())
      .mockResolvedValueOnce(okInvite({ approximate_member_count: 196 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await callRoute(await loadRoute());

    expect(res.body).toEqual({ discordMembers: '196' });
    expect(String(fetchMock.mock.calls[1][0])).toContain(FALLBACK_CODE);
  });

  it('falls back when an invite resolves without a member count', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(okInvite({ code: PRIMARY_CODE }))
      .mockResolvedValueOnce(okInvite({ approximate_member_count: 7 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect((await callRoute(await loadRoute())).body).toEqual({ discordMembers: '7' });
  });

  it('falls back when an invite resolves to a non-object payload', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(okInvite(null))
      .mockResolvedValueOnce(okInvite({ approximate_member_count: 8 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect((await callRoute(await loadRoute())).body).toEqual({ discordMembers: '8' });
  });

  it('returns a null count that is not cached when every lookup fails', async () => {
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const res = await callRoute(await loadRoute());

    // Null rather than an error status: the caller keeps its loading placeholder
    // and never paints a fabricated number.
    expect(res.body).toEqual({ discordMembers: null });
    expect(res.init?.headers?.['Cache-Control']).toBe('no-store');
  });

  it('serves a second request from the cached count without calling Discord again', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okInvite({ approximate_member_count: 1204 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const route = await loadRoute();

    expect((await callRoute(route)).body).toEqual({ discordMembers: '1,204' });
    const second = await callRoute(route);

    expect(second.body).toEqual({ discordMembers: '1,204' });
    expect(second.init?.headers?.['Cache-Control']).toBe(CACHED);
    // One upstream call for two requests.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries Discord immediately after a failure rather than caching it', async () => {
    // The regression this guards: a 200 with no member count used to be cached by
    // the fetch layer, so the count stayed blank for the whole TTL after Discord
    // recovered. Only parsed counts are cached now.
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(okInvite({ code: PRIMARY_CODE }))
      .mockResolvedValueOnce(okInvite({ code: FALLBACK_CODE }))
      .mockResolvedValue(okInvite({ approximate_member_count: 311 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const route = await loadRoute();

    expect((await callRoute(route)).body).toEqual({ discordMembers: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Next request goes back out to Discord and picks up the recovered count.
    expect((await callRoute(route)).body).toEqual({ discordMembers: '311' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('refetches once the cached count has aged past its TTL', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(okInvite({ approximate_member_count: 100 }))
      .mockResolvedValue(okInvite({ approximate_member_count: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const route = await loadRoute();

    expect((await callRoute(route)).body).toEqual({ discordMembers: '100' });

    nowSpy.mockReturnValue(1_000_000 + 300_001);
    expect((await callRoute(route)).body).toEqual({ discordMembers: '200' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
