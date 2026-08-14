/**
 * Same `next/server` stub as the sibling route tests: jsdom has no Web
 * `Response`, so mocking the one factory the handler uses keeps the whole
 * handler under test, cache headers and status included.
 */
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      body,
      init,
    }),
  },
}));

import { GET } from '@/app/api/community/github-releases/route';

type Release = { tag_name?: string; html_url?: string; name?: string; published_at?: string };

type MockedResponse = {
  body: Release | Release[] | null | { error?: string };
  init?: { status?: number; headers?: Record<string, string> };
};

type FetchLike = typeof fetch;

const makeRes = (data: unknown) =>
  ({ ok: true, json: () => Promise.resolve(data) }) as unknown as Response;

const notOk = () => ({ ok: false, json: () => Promise.resolve(null) }) as unknown as Response;

const BASE = 'https://yosemitecrew.com/api/community/github-releases';
const call = async (url = BASE) => (await GET({ url } as Request)) as unknown as MockedResponse;

const RELEASE: Release & { extra?: string } = {
  tag_name: 'v9.9.9',
  html_url: 'https://github.com/YosemiteCrew/Yosemite-Crew/releases/tag/v9.9.9',
  name: 'Ninth',
  published_at: '2026-08-01T00:00:00Z',
  extra: 'should not be forwarded',
};

const originalFetch = globalThis.fetch;

describe('github-releases route handler', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the latest release, trimmed to the fields the pill needs', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve(makeRes(RELEASE))) as unknown as FetchLike;

    const res = await call();

    expect(res.body).toEqual({
      tag_name: 'v9.9.9',
      html_url: RELEASE.html_url,
      name: 'Ninth',
      published_at: '2026-08-01T00:00:00Z',
    });
    // The raw GitHub payload is large and its shape is not ours to depend on.
    expect(res.body).not.toHaveProperty('extra');
    expect(res.init?.headers?.['Cache-Control']).toContain('s-maxage=300');
  });

  it('requests the latest endpoint when no list flag is given', async () => {
    const fetchMock = jest.fn((_input: RequestInfo | URL) => Promise.resolve(makeRes(RELEASE)));
    globalThis.fetch = fetchMock as unknown as FetchLike;

    await call();

    expect(String(fetchMock.mock.calls[0][0])).toContain('/releases/latest');
  });

  it('requests the paged list when list=1 and trims every entry', async () => {
    const fetchMock = jest.fn((_input: RequestInfo | URL) =>
      Promise.resolve(makeRes([RELEASE, RELEASE]))
    );
    globalThis.fetch = fetchMock as unknown as FetchLike;

    const res = await call(`${BASE}?list=1`);

    expect(String(fetchMock.mock.calls[0][0])).toContain('/releases?per_page=30');
    expect(res.body).toHaveLength(2);
    expect((res.body as Release[])[0]).not.toHaveProperty('extra');
    expect(res.init?.headers?.['Cache-Control']).toContain('s-maxage=300');
  });

  // `list` is the only accepted parameter and `1` its only accepted value.
  // Treating any other value as "the latest request" would leave the
  // quota-exhaustion path open that rejecting unknown parameters closes: the
  // shared cache keys on the whole URL, so `?list=<random>` misses it every time
  // and repeats the upstream call, exactly as `?nonce=<random>` would.
  it.each(['?list=0', '?list=', '?list=1&list=1', '?list=1&nonce=abc'])(
    'refuses %s without calling upstream',
    async (query) => {
      const fetchMock = jest.fn((_input: RequestInfo | URL) => Promise.resolve(makeRes(RELEASE)));
      globalThis.fetch = fetchMock as unknown as FetchLike;

      const res = await call(`${BASE}${query}`);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(res.init?.status).toBe(400);
      expect(res.init?.headers?.['Cache-Control']).toBe('no-store');
    }
  );

  it('serves the latest release when no query is present', async () => {
    const fetchMock = jest.fn((_input: RequestInfo | URL) => Promise.resolve(makeRes(RELEASE)));
    globalThis.fetch = fetchMock as unknown as FetchLike;

    await call(BASE);

    expect(String(fetchMock.mock.calls[0][0])).toContain('/releases/latest');
  });

  it('caches nothing when the latest lookup is not ok', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve(notOk())) as unknown as FetchLike;

    const res = await call();

    expect(res.body).toBeNull();
    expect(res.init?.headers?.['Cache-Control']).toBe('no-store');
  });

  it('caches nothing when the list lookup is not ok', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve(notOk())) as unknown as FetchLike;

    const res = await call(`${BASE}?list=1`);

    expect(res.body).toEqual([]);
    expect(res.init?.headers?.['Cache-Control']).toBe('no-store');
  });

  it('caches nothing when the latest payload carries no tag', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(makeRes({ html_url: 'x' }))
    ) as unknown as FetchLike;

    const res = await call();

    expect(res.body).toBeNull();
    expect(res.init?.headers?.['Cache-Control']).toBe('no-store');
  });

  it('caches nothing when the list payload is not an array', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(makeRes({ not: 'a list' }))
    ) as unknown as FetchLike;

    const res = await call(`${BASE}?list=1`);

    expect(res.body).toEqual([]);
    expect(res.init?.headers?.['Cache-Control']).toBe('no-store');
  });

  it.each([
    ['the latest request', BASE, null],
    ['the list request', `${BASE}?list=1`, []],
  ])('survives %s throwing', async (_label, url, expected) => {
    globalThis.fetch = jest.fn(() =>
      Promise.reject(new Error('network down'))
    ) as unknown as FetchLike;

    const res = await call(url);

    expect(res.body).toEqual(expected);
    expect(res.init?.headers?.['Cache-Control']).toBe('no-store');
  });

  it('refuses query parameters other than list, without calling upstream', async () => {
    const fetchMock = jest.fn((_input: RequestInfo | URL) => Promise.resolve(makeRes(RELEASE)));
    globalThis.fetch = fetchMock as unknown as FetchLike;

    const res = await call(`${BASE}?list=1&nonce=abc`);

    expect(res.init?.status).toBe(400);
    expect((res.body as { error?: string }).error).toContain('nonce');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
