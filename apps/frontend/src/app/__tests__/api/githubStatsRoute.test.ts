/**
 * Mirrors the discord-members route test: the handler returns a `NextResponse`,
 * which needs the Web `Response` global that jsdom does not provide. Mocking
 * `next/server` down to the one factory the route uses keeps the whole handler
 * under test, cache headers included, without switching the suite to a node
 * environment (jest.setup.ts touches `HTMLElement`, so it cannot run there).
 */
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      body,
      init,
    }),
  },
}));

import { GET } from '@/app/api/community/github-stats/route';

type MockedResponse = {
  body: Record<string, string | null> & { error?: string };
  init?: { status?: number; headers?: Record<string, string> };
};

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

const request = (url = 'https://yosemitecrew.com/api/community/github-stats') =>
  ({ url }) as Request;

const call = async (url?: string) => (await GET(request(url))) as unknown as MockedResponse;

const originalFetch = globalThis.fetch;

describe('github-stats route handler', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('resolves stars, repository clones and contributors in one response', async () => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('summary.json'))
        return Promise.resolve(makeRes({ clones: { total: 67134 } }));
      if (url.includes('contributors'))
        // 58 people plus 2 bots. The bots must not reach the response.
        return Promise.resolve(
          makeRes([
            ...Array.from({ length: 58 }, () => ({ type: 'User' })),
            { type: 'Bot' },
            { type: 'Bot' },
          ])
        );
      if (url.endsWith('/Yosemite-Crew'))
        return Promise.resolve(makeRes({ stargazers_count: 2431 }));
      return Promise.resolve(notOk());
    }) as unknown as FetchLike;

    const res = await call();

    expect(res.body).toEqual({
      stars: '2.4k',
      starsFull: '2,431',
      repositoryClones: '67,134',
      contributors: '58',
    });
    // Shared caches only: the browser must still ask us, because the surfaces
    // using this advertise live numbers.
    expect(res.init?.headers?.['Cache-Control']).toContain('s-maxage=300');
    expect(res.init?.headers?.['Cache-Control']).toContain('max-age=0');
  });

  it('formats a sub-thousand star count without the k suffix', async () => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL) =>
      String(input).endsWith('/Yosemite-Crew')
        ? Promise.resolve(makeRes({ stargazers_count: 943 }))
        : Promise.resolve(notOk())
    ) as unknown as FetchLike;

    const res = await call();

    expect(res.body.stars).toBe('943');
    expect(res.body.starsFull).toBe('943');
  });

  it('reads the clone total from the chart dataset shape', async () => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL) =>
      String(input).includes('summary.json')
        ? Promise.resolve(
            makeRes({
              charts: {
                '#clones_total': { datasets: { a: [{ clones_total: 40 }, { clones_total: 27 }] } },
              },
            })
          )
        : Promise.resolve(notOk())
    ) as unknown as FetchLike;

    expect((await call()).body.repositoryClones).toBe('67');
  });

  it('treats a chart entry with no clone count as zero', async () => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL) =>
      String(input).includes('summary.json')
        ? Promise.resolve(
            makeRes({ charts: { '#clones_total': { datasets: { a: [{}, { clones_total: 5 }] } } } })
          )
        : Promise.resolve(notOk())
    ) as unknown as FetchLike;

    expect((await call()).body.repositoryClones).toBe('5');
  });

  it.each([
    ['a summary with neither supported clone shape', { something: 'else' }],
    [
      'a summary whose chart dataset is not a list',
      { charts: { '#clones_total': { datasets: { a: 'nope' } } } },
    ],
    ['a summary that is not an object', 'not-json-object'],
    ['a null summary', null],
  ])('reports no clone count for %s', async (_label, payload) => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL) =>
      String(input).includes('summary.json')
        ? Promise.resolve(makeRes(payload))
        : Promise.resolve(notOk())
    ) as unknown as FetchLike;

    expect((await call()).body.repositoryClones).toBeNull();
  });

  it('reports no star count when the repo payload has no numeric star field', async () => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL) =>
      String(input).endsWith('/Yosemite-Crew')
        ? Promise.resolve(makeRes({ stargazers_count: 'many' }))
        : Promise.resolve(notOk())
    ) as unknown as FetchLike;

    const res = await call();

    expect(res.body.stars).toBeNull();
    expect(res.body.starsFull).toBeNull();
  });

  it('excludes bot accounts from the contributor count', async () => {
    // dependabot and the Aikido autofix account both appear on the contributor
    // graph. They are not people and must not inflate the headline figure.
    const withBots = {
      ok: true,
      json: () =>
        Promise.resolve([
          { type: 'User' },
          { type: 'User' },
          { type: 'Anonymous' },
          { type: 'Bot' },
          { type: 'Bot' },
        ]),
      headers: { get: () => null },
    } as unknown as Response;
    globalThis.fetch = jest.fn((input: RequestInfo | URL) =>
      String(input).includes('contributors') ? Promise.resolve(withBots) : Promise.resolve(notOk())
    ) as unknown as FetchLike;

    // 5 entries, 2 bots, so 3 people. Anonymous entries are real humans whose
    // commit emails were never linked to an account, so they are kept.
    expect((await call()).body.contributors).toBe('3');
  });

  it.each([
    ['a non-array body', { message: 'nope' }],
    ['a null body', null],
  ])('reports no contributor count for %s', async (_label, payload) => {
    const badShape = {
      ok: true,
      json: () => Promise.resolve(payload),
      headers: { get: () => null },
    } as unknown as Response;
    globalThis.fetch = jest.fn((input: RequestInfo | URL) =>
      String(input).includes('contributors') ? Promise.resolve(badShape) : Promise.resolve(notOk())
    ) as unknown as FetchLike;

    expect((await call()).body.contributors).toBeNull();
  });

  it('caches nothing when every upstream lookup fails', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve(notOk())) as unknown as FetchLike;

    const res = await call();

    expect(res.body).toEqual({
      stars: null,
      starsFull: null,
      repositoryClones: null,
      contributors: null,
    });
    // A transient outage must be retried on the next request, never pinned as
    // nulls for the whole TTL.
    expect(res.init?.headers?.['Cache-Control']).toBe('no-store');
  });

  it('still caches a partial result when only some lookups resolve', async () => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL) =>
      String(input).endsWith('/Yosemite-Crew')
        ? Promise.resolve(makeRes({ stargazers_count: 12 }))
        : Promise.resolve(notOk())
    ) as unknown as FetchLike;

    const res = await call();

    expect(res.body.stars).toBe('12');
    expect(res.body.contributors).toBeNull();
    expect(res.init?.headers?.['Cache-Control']).toContain('s-maxage=300');
  });

  it.each([
    ['the stars lookup', '/Yosemite-Crew'],
    ['the repository clones lookup', 'summary.json'],
    ['the contributors lookup', 'contributors'],
  ])('survives %s throwing', async (_label, failing) => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL) =>
      String(input).includes(failing)
        ? Promise.reject(new Error('network down'))
        : Promise.resolve(notOk())
    ) as unknown as FetchLike;

    const res = await call();

    expect(res.body).toBeDefined();
    expect(res.init?.headers?.['Cache-Control']).toBe('no-store');
  });

  it('refuses cache-busting query parameters without calling upstream', async () => {
    // Shared caches key on the full URL, so `?nonce=` would miss the cache every
    // time and repeat the three upstream calls, burning the shared GitHub quota.
    const fetchMock = jest.fn(() => Promise.resolve(notOk()));
    globalThis.fetch = fetchMock as unknown as FetchLike;

    const res = await call('https://yosemitecrew.com/api/community/github-stats?nonce=abc&x=1');

    expect(res.init?.status).toBe(400);
    expect(res.body.error).toContain('nonce');
    expect(res.body.error).toContain('x');
    expect(res.init?.headers?.['Cache-Control']).toBe('no-store');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // This route takes no query at all, so anything after `?` is a distinct
  // shared-cache key for identical work. Separator-only forms parse to zero
  // keys, and inherited Object.prototype names must not be read out of the
  // allowlist object - doing so throws and turns a 400 into a 500.
  it.each(['?&', '?&&', '?constructor=1', '?__proto__=1', '?toString=1', '?valueOf=1'])(
    'refuses %s with a 400 and no upstream call',
    async (query) => {
      const fetchMock = jest.fn(() => Promise.resolve(notOk()));
      globalThis.fetch = fetchMock as unknown as FetchLike;

      const res = await call(`https://yosemitecrew.com/api/community/github-stats${query}`);

      expect(res.init?.status).toBe(400);
      expect(res.init?.headers?.['Cache-Control']).toBe('no-store');
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );
});
