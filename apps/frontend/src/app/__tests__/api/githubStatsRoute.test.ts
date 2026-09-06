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

/**
 * The EXACT string the repo-stats workflow writes into `summary.json`. It is not
 * ISO 8601, and the route parses it with its own pattern precisely because
 * `Date.parse` accepting this shape is an engine choice rather than a guarantee.
 * Fixtures use this literal rather than a tidy ISO stamp on purpose: a fixture in
 * a format the production data never uses cannot fail on the production data.
 */
const FRESH_STAMP = '2026-08-24 23:06 UTC';
/** 54 minutes after FRESH_STAMP, so that report is comfortably inside 72h. */
const NOW = new Date('2026-08-25T00:00:00Z');
/** The real incident: the report that sat unchanged for thirteen days. */
const STALE_STAMP = '2026-08-11 23:06 UTC';

const fresh = (payload: Record<string, unknown>) => ({
  generated_at_utc: FRESH_STAMP,
  ...payload,
});

const summaryOnly = (payload: unknown) =>
  jest.fn((input: RequestInfo | URL) =>
    String(input).includes('summary.json')
      ? Promise.resolve(makeRes(payload))
      : Promise.resolve(notOk())
  ) as unknown as FetchLike;

describe('github-stats route handler', () => {
  // Per-test, NOT beforeAll: jest.setup.ts installs a global
  // `afterEach(() => jest.clearAllTimers())`, which drops the faked system time
  // after the first test. Installing it once leaves every later test silently
  // reading the REAL clock, so a freshness fixture stamped days ago is judged
  // stale for the wrong reason and the assertion it was written for never runs.
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('resolves stars, repository clones and contributors in one response', async () => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('summary.json'))
        return Promise.resolve(makeRes(fresh({ clones: { total: 67134 } })));
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
            makeRes(
              fresh({
                charts: {
                  '#clones_total': {
                    datasets: { a: [{ clones_total: 40 }, { clones_total: 27 }] },
                  },
                },
              })
            )
          )
        : Promise.resolve(notOk())
    ) as unknown as FetchLike;

    expect((await call()).body.repositoryClones).toBe('67');
  });

  it('treats a chart entry with no clone count as zero', async () => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL) =>
      String(input).includes('summary.json')
        ? Promise.resolve(
            makeRes(
              fresh({ charts: { '#clones_total': { datasets: { a: [{}, { clones_total: 5 }] } } } })
            )
          )
        : Promise.resolve(notOk())
    ) as unknown as FetchLike;

    expect((await call()).body.repositoryClones).toBe('5');
  });

  it.each([
    [
      'a summary with neither supported clone shape',
      { generated_at_utc: FRESH_STAMP, something: 'else' },
    ],
    [
      'a summary whose chart dataset is not a list',
      {
        generated_at_utc: FRESH_STAMP,
        charts: { '#clones_total': { datasets: { a: 'nope' } } },
      },
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

  // The clone count is the only metric here whose feed can go stale while still
  // answering 200, so it is the only one that can be wrong rather than absent.
  // Every rejection below must land on null - the same degraded state a failed
  // lookup produces - and never on a published number.
  describe('clone-count freshness', () => {
    it("publishes the count for a report stamped in the workflow's own format", async () => {
      globalThis.fetch = summaryOnly({
        generated_at_utc: FRESH_STAMP,
        clones: { total: 67134 },
      });

      expect((await call()).body.repositoryClones).toBe('67,134');
    });

    it('drops the count for the thirteen-day-old report from the real incident', async () => {
      globalThis.fetch = summaryOnly({
        generated_at_utc: STALE_STAMP,
        clones: { total: 183516 },
      });

      // The value is present, parseable and wrong. Publishing it is the bug.
      expect((await call()).body.repositoryClones).toBeNull();
    });

    it.each([
      ['no stamp at all', {}],
      ['a stamp that is not a string', { generated_at_utc: 1756076760000 }],
      ['a stamp that is not a date', { generated_at_utc: 'not-a-date' }],
      ['an empty stamp', { generated_at_utc: '' }],
      // Date.UTC rolls month 13 forward into the next year, which would make this
      // malformed stamp read as a FUTURE date and therefore fresh. The bounds live
      // in the pattern to stop exactly that.
      ['a month outside 1-12', { generated_at_utc: '2026-13-01 00:00 UTC' }],
      ['a day outside 1-31', { generated_at_utc: '2026-08-32 00:00 UTC' }],
      ['an hour outside 0-23', { generated_at_utc: '2026-08-24 24:00 UTC' }],
      ['a stamp with no zone', { generated_at_utc: '2026-08-24 23:06' }],
      // Every case above is a PATTERN rejection, so none of them reaches the
      // freshness comparison. These do: each parses to a real instant and is
      // refused by the window itself.
      ['a stamp one day in the future', { generated_at_utc: '2026-08-26 00:00 UTC' }],
      ['a stamp four months in the future', { generated_at_utc: '2027-01-01 00:00 UTC' }],
      ['a stamp that would be fresh forever', { generated_at_utc: '9999-12-31 00:00 UTC' }],
    ])('fails closed on %s', async (_label, stamp) => {
      globalThis.fetch = summaryOnly({ ...stamp, clones: { total: 67134 } });

      expect((await call()).body.repositoryClones).toBeNull();
    });

    it.each([
      ['the workflow format', '2026-08-24 23:06 UTC'],
      ['the same instant with seconds', '2026-08-24 23:06:45 UTC'],
      ['an ISO-shaped stamp, should the generator ever switch', '2026-08-24T23:06:00Z'],
    ])('accepts %s', async (_label, generated_at_utc) => {
      globalThis.fetch = summaryOnly({ generated_at_utc, clones: { total: 5 } });

      expect((await call()).body.repositoryClones).toBe('5');
    });

    // The window is 72h because the workflow is daily and two missed runs should
    // not blank the number. These pin both sides of that edge.
    it('publishes a report just inside the 72 hour window', async () => {
      globalThis.fetch = summaryOnly({
        generated_at_utc: '2026-08-22 00:01 UTC',
        clones: { total: 9 },
      });

      expect((await call()).body.repositoryClones).toBe('9');
    });

    // The stamp is written by a GitHub runner and read by this server; the two
    // clocks are not synchronised, so a report generated seconds ago can carry a
    // timestamp slightly ahead. That must not blank a good number - but the
    // allowance is minutes, not enough to rescue anything actually stale.
    it('publishes a report stamped a little ahead of this server', async () => {
      globalThis.fetch = summaryOnly({
        generated_at_utc: '2026-08-25 00:02 UTC',
        clones: { total: 11 },
      });

      expect((await call()).body.repositoryClones).toBe('11');
    });

    it('drops a report stamped beyond the skew allowance', async () => {
      globalThis.fetch = summaryOnly({
        generated_at_utc: '2026-08-25 00:06 UTC',
        clones: { total: 11 },
      });

      expect((await call()).body.repositoryClones).toBeNull();
    });

    it('drops a report just outside the 72 hour window', async () => {
      globalThis.fetch = summaryOnly({
        generated_at_utc: '2026-08-21 23:59 UTC',
        clones: { total: 9 },
      });

      expect((await call()).body.repositoryClones).toBeNull();
    });

    // An impossible day rolls FORWARD through Date.UTC, and against the clock
    // above every such roll lands in the past and is refused by the window - so
    // those cases prove nothing about the round-trip. These set the clock so the
    // rolled date would be comfortably FRESH, which leaves the component
    // round-trip as the only thing that can reject them. Each pair carries a
    // valid neighbouring date as its control: if the control did not publish,
    // the rejection would be the window talking, not the round-trip.
    describe.each([
      [
        'a 31st in a 30-day month',
        '2026-05-01T12:00:00Z',
        '2026-04-31 00:00 UTC',
        '2026-04-30 00:00 UTC',
      ],
      [
        'a 29th of February in a non-leap year',
        '2026-03-01T12:00:00Z',
        '2026-02-29 00:00 UTC',
        '2026-02-28 00:00 UTC',
      ],
    ])('%s', (_label, clock, impossible, control) => {
      beforeEach(() => {
        jest.useFakeTimers().setSystemTime(new Date(clock));
      });

      it('publishes the valid neighbouring date, so the window is not what rejects', async () => {
        globalThis.fetch = summaryOnly({ generated_at_utc: control, clones: { total: 7 } });

        expect((await call()).body.repositoryClones).toBe('7');
      });

      it('drops the impossible date even though the rolled value would be fresh', async () => {
        globalThis.fetch = summaryOnly({ generated_at_utc: impossible, clones: { total: 7 } });

        expect((await call()).body.repositoryClones).toBeNull();
      });
    });

    it('leaves the other metrics alone when the report is stale', async () => {
      globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('summary.json'))
          return Promise.resolve(
            makeRes({ generated_at_utc: STALE_STAMP, clones: { total: 183516 } })
          );
        if (url.includes('contributors'))
          return Promise.resolve(makeRes([{ type: 'User' }, { type: 'User' }]));
        if (url.endsWith('/Yosemite-Crew'))
          return Promise.resolve(makeRes({ stargazers_count: 2020 }));
        return Promise.resolve(notOk());
      }) as unknown as FetchLike;

      const res = await call();

      // Stars and contributors come from the public API and were never affected by
      // the workflow breaking - dropping the clone count must not take them with it.
      expect(res.body.repositoryClones).toBeNull();
      expect(res.body.starsFull).toBe('2,020');
      expect(res.body.contributors).toBe('2');
      // Something resolved, so the response is still cacheable.
      expect(res.init?.headers?.['Cache-Control']).toContain('s-maxage=300');
    });
  });
});
