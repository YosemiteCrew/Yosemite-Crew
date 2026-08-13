/**
 * Mirrors the discord-members route test: the handler returns a `NextResponse`,
 * which needs the Web `Response` global that jsdom does not provide. Mocking
 * `next/server` down to the one factory the route uses keeps the whole handler
 * under test, cache headers included, without switching the suite to a node
 * environment (jest.setup.ts touches `HTMLElement`, so it cannot run there).
 */
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { headers?: Record<string, string> }) => ({ body, init }),
  },
}));

import { GET } from '@/app/api/community/github-stats/route';

type MockedResponse = {
  body: Record<string, string | null>;
  init?: { headers?: Record<string, string> };
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

const originalFetch = globalThis.fetch;

describe('github-stats route handler', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('resolves stars, self-hosters and contributors in one response', async () => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('summary.json'))
        return Promise.resolve(makeRes({ clones: { total: 67134 } }));
      if (url.includes('contributors'))
        return Promise.resolve(makeRes([], '<u&page=58>; rel="last"'));
      if (url.endsWith('/Yosemite-Crew'))
        return Promise.resolve(makeRes({ stargazers_count: 2431 }));
      return Promise.resolve(notOk());
    }) as unknown as FetchLike;

    const res = (await GET()) as unknown as MockedResponse;

    expect(res.body).toEqual({
      stars: '2.4k',
      starsFull: '2,431',
      selfHosters: '67,134',
      contributors: '58',
    });
    expect(res.init?.headers?.['Cache-Control']).toContain('max-age=300');
  });

  it('reads the self-hoster total from the chart dataset shape', async () => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('summary.json'))
        return Promise.resolve(
          makeRes({
            charts: {
              '#clones_total': { datasets: { a: [{ clones_total: 40 }, { clones_total: 27 }] } },
            },
          })
        );
      return Promise.resolve(notOk());
    }) as unknown as FetchLike;

    const res = (await GET()) as unknown as MockedResponse;

    expect(res.body.selfHosters).toBe('67');
  });

  it('caches nothing when every upstream lookup fails', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve(notOk())) as unknown as FetchLike;

    const res = (await GET()) as unknown as MockedResponse;

    expect(res.body).toEqual({
      stars: null,
      starsFull: null,
      selfHosters: null,
      contributors: null,
    });
    // A transient outage must be retried on the next request, never pinned as
    // nulls for the whole TTL.
    expect(res.init?.headers?.['Cache-Control']).toBe('no-store');
  });

  it('still caches a partial result when only some lookups resolve', async () => {
    globalThis.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/Yosemite-Crew')) return Promise.resolve(makeRes({ stargazers_count: 12 }));
      return Promise.resolve(notOk());
    }) as unknown as FetchLike;

    const res = (await GET()) as unknown as MockedResponse;

    expect(res.body.stars).toBe('12');
    expect(res.body.contributors).toBeNull();
    expect(res.init?.headers?.['Cache-Control']).toContain('max-age=300');
  });

  it('survives an upstream that throws', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.reject(new Error('network down'))
    ) as unknown as FetchLike;

    const res = (await GET()) as unknown as MockedResponse;

    expect(res.body.stars).toBeNull();
  });
});
