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

import { GET } from '@/app/api/community/cloud-users/route';

type MockedResponse = {
  body: { totalUsers: string | null; latestSignupAt: string | null } | { error?: string };
  init?: { status?: number; headers?: Record<string, string> };
};

type FetchLike = typeof fetch;

const makeRes = (data: unknown) =>
  ({ ok: true, json: () => Promise.resolve(data) }) as unknown as Response;

const notOk = () => ({ ok: false, json: () => Promise.resolve(null) }) as unknown as Response;

const BASE = 'https://yosemitecrew.com/api/community/cloud-users';
const call = async (url = BASE) => (await GET({ url } as Request)) as unknown as MockedResponse;

const originalFetch = globalThis.fetch;

describe('GET /api/community/cloud-users', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the localized total and the latest signup timestamp', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(makeRes({ totalUsers: 346, latestSignupAt: '2026-09-12T11:46:00.000Z' }))
    ) as unknown as FetchLike;

    const res = await call();

    expect(res.body).toEqual({
      totalUsers: '346',
      latestSignupAt: '2026-09-12T11:46:00.000Z',
    });
    expect(res.init?.headers?.['Cache-Control']).toMatch(/s-maxage=300/);
  });

  it('calls the SuperAdmin panel origin, not a relative or third-party URL', async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve(makeRes({ totalUsers: 1, latestSignupAt: null }))
    ) as unknown as FetchLike;
    globalThis.fetch = fetchMock;

    await call();

    expect(String((fetchMock as jest.Mock).mock.calls[0][0])).toBe(
      'https://admin.yosemitecrew.com/api/cloud-users'
    );
  });

  it('never caches the upstream request itself', async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve(makeRes({ totalUsers: 5, latestSignupAt: null }))
    ) as unknown as FetchLike;
    globalThis.fetch = fetchMock;

    await call();

    const init = (fetchMock as jest.Mock).mock.calls[0][1] as RequestInit;
    expect(init.cache).toBe('no-store');
  });

  it('rejects an unexpected query parameter with a 400, not a cache-busting pass-through', async () => {
    const res = await call(`${BASE}?nonce=abc`);
    expect(res.init?.status).toBe(400);
  });

  it('reports nulls, uncached, when the upstream responds non-OK', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve(notOk())) as unknown as FetchLike;

    const res = await call();

    expect(res.body).toEqual({ totalUsers: null, latestSignupAt: null });
    expect(res.init?.headers?.['Cache-Control']).toBe('no-store');
  });

  it('reports nulls, uncached, when the upstream request throws', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.reject(new Error('network down'))
    ) as unknown as FetchLike;

    const res = await call();

    expect(res.body).toEqual({ totalUsers: null, latestSignupAt: null });
    expect(res.init?.headers?.['Cache-Control']).toBe('no-store');
  });

  it('treats a non-numeric totalUsers from upstream as unavailable rather than forwarding it raw', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(makeRes({ totalUsers: 'not-a-number', latestSignupAt: null }))
    ) as unknown as FetchLike;

    const res = await call();

    expect(res.body).toEqual({ totalUsers: null, latestSignupAt: null });
    expect(res.init?.headers?.['Cache-Control']).toBe('no-store');
  });

  it('does not cache a response that resolved no total even if latestSignupAt came through', async () => {
    // A recency timestamp with no total is not "this pass succeeded" - caching it
    // would replay a half-populated stat for the whole shared-cache window.
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(makeRes({ totalUsers: null, latestSignupAt: '2026-09-12T11:46:00.000Z' }))
    ) as unknown as FetchLike;

    const res = await call();

    expect(res.body).toEqual({ totalUsers: null, latestSignupAt: '2026-09-12T11:46:00.000Z' });
    expect(res.init?.headers?.['Cache-Control']).toBe('no-store');
  });
});
