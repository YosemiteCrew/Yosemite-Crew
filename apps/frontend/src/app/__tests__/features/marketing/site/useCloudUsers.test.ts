import { renderHook, waitFor } from '@testing-library/react';
import { useCloudUsers } from '@/app/features/marketing/site/useCloudUsers';

type FetchLike = typeof fetch;

const makeRes = (data: unknown) =>
  ({ ok: true, json: () => Promise.resolve(data) }) as unknown as Response;
const notOk = () => ({ ok: false, json: () => Promise.resolve(null) }) as unknown as Response;

const ENDPOINT = '/api/community/cloud-users';
const CACHE_KEY = 'yc_cloud_users_v1';
const TS_KEY = 'yc_cloud_users_ts_v1';

describe('useCloudUsers', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('resolves the total and latest signup from the proxy route', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(makeRes({ totalUsers: '346', latestSignupAt: '2026-09-12T11:46:00.000Z' }))
    ) as unknown as FetchLike;

    const { result } = renderHook(() => useCloudUsers());

    await waitFor(() => expect(result.current.totalUsers).toBe('346'));
    expect(result.current.latestSignupAt).toBe('2026-09-12T11:46:00.000Z');
  });

  it('calls the same-origin proxy, never a cross-origin URL', async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve(makeRes({ totalUsers: '1', latestSignupAt: null }))
    );
    globalThis.fetch = fetchMock as unknown as FetchLike;

    renderHook(() => useCloudUsers());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(ENDPOINT));
  });

  it('starts from the loading placeholder before the fetch resolves', async () => {
    // Resolved after the assertion below, not left permanently pending: this
    // hook dedupes concurrent fetches through a module-level in-flight promise,
    // so a mock that never settles here would starve every later test in this
    // file of its own fetch call.
    let resolveFetch: (res: Response) => void = () => {};
    globalThis.fetch = jest.fn(
      () => new Promise<Response>((resolve) => (resolveFetch = resolve))
    ) as unknown as FetchLike;

    const { result } = renderHook(() => useCloudUsers());

    expect(result.current).toEqual({ totalUsers: null, latestSignupAt: null });
    resolveFetch(makeRes({ totalUsers: '1', latestSignupAt: null }));
    await waitFor(() => expect(result.current.totalUsers).toBe('1'));
  });

  it('skips the network entirely when the session cache is still fresh', () => {
    const fetchMock = jest.fn(() => Promise.resolve(makeRes(null)));
    globalThis.fetch = fetchMock as unknown as FetchLike;
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ totalUsers: '400', latestSignupAt: null }));
    sessionStorage.setItem(TS_KEY, String(Date.now()));

    const { result } = renderHook(() => useCloudUsers());

    expect(result.current.totalUsers).toBe('400');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refetches once the cached snapshot has expired', async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve(makeRes({ totalUsers: '500', latestSignupAt: null }))
    );
    globalThis.fetch = fetchMock as unknown as FetchLike;
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ totalUsers: '400', latestSignupAt: null }));
    sessionStorage.setItem(TS_KEY, String(Date.now() - 6 * 60 * 1000));

    renderHook(() => useCloudUsers());

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(sessionStorage.getItem(CACHE_KEY)).toContain('500'));
  });

  it('keeps the previous cached value when a refresh fails', async () => {
    // Checked via waitFor, not a fixed-delay read: a version that overwrites
    // the cache with an empty value on a non-OK response (rather than leaving
    // it untouched, like a thrown network error already does) settles almost
    // immediately, so a bare setTimeout(0) can read before the overwrite lands
    // and pass anyway. waitFor keeps re-checking across real time instead.
    const fetchMock = jest.fn(() => Promise.resolve(notOk()));
    globalThis.fetch = fetchMock as unknown as FetchLike;
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ totalUsers: '400', latestSignupAt: null }));

    const { result } = renderHook(() => useCloudUsers());

    expect(result.current.totalUsers).toBe('400');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(sessionStorage.getItem(CACHE_KEY)).toContain('400'));
    expect(sessionStorage.getItem(TS_KEY)).toBeNull();
    expect(result.current.totalUsers).toBe('400');
  });

  it('keeps the previous cached value when the proxy reports a 200 with no total', async () => {
    // The proxy route signals an upstream failure as a 200 with a null total,
    // not a non-OK status (see its own route.ts) - this is the failure shape
    // that actually reaches this hook, distinct from the notOk() case above.
    const fetchMock = jest.fn(() =>
      Promise.resolve(makeRes({ totalUsers: null, latestSignupAt: null }))
    );
    globalThis.fetch = fetchMock as unknown as FetchLike;
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ totalUsers: '400', latestSignupAt: null }));

    const { result } = renderHook(() => useCloudUsers());

    expect(result.current.totalUsers).toBe('400');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(sessionStorage.getItem(CACHE_KEY)).toContain('400'));
    expect(sessionStorage.getItem(TS_KEY)).toBeNull();
    expect(result.current.totalUsers).toBe('400');
  });

  it('rejects a shape-invalid cached value instead of handing it to the caller unchecked', () => {
    // A value like this can only get into sessionStorage via tampering (the
    // route's own response is always string|null on these fields) - this
    // guards the trust boundary, not a real proxy response shape. The mount
    // effect also fires a real (resolving) fetch here - a never-resolving one
    // would permanently pin the module-level inFlight promise and starve
    // every later test in this file of its own fetch call.
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ totalUsers: { x: 1 }, latestSignupAt: 42 }));
    globalThis.fetch = jest.fn(() =>
      Promise.resolve(makeRes({ totalUsers: null, latestSignupAt: null }))
    ) as unknown as FetchLike;

    const { result } = renderHook(() => useCloudUsers());

    expect(result.current).toEqual({ totalUsers: null, latestSignupAt: null });
  });

  it('dedupes concurrent mounts into a single request', async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve(makeRes({ totalUsers: '346', latestSignupAt: null }))
    );
    globalThis.fetch = fetchMock as unknown as FetchLike;

    renderHook(() => useCloudUsers());
    renderHook(() => useCloudUsers());
    renderHook(() => useCloudUsers());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('propagates a fresh fetch to a second, already-mounted instance', async () => {
    // A distinct second value proves this via call count AND content: a naive
    // per-instance fetch (no shared store/dedup) would call fetch twice and
    // give `second` this second value instead of the first one it never made.
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(makeRes({ totalUsers: '346', latestSignupAt: null }))
      .mockResolvedValue(makeRes({ totalUsers: 'WRONG-IF-REFETCHED', latestSignupAt: null }));
    globalThis.fetch = fetchMock as unknown as FetchLike;

    const first = renderHook(() => useCloudUsers());
    const second = renderHook(() => useCloudUsers());

    await waitFor(() => expect(first.result.current.totalUsers).toBe('346'));
    expect(second.result.current.totalUsers).toBe('346');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
