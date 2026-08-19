import { renderHook, waitFor } from '@testing-library/react';
import {
  getPlatformStatusState,
  platformStatusByValue,
  usePlatformStatus,
} from '@/app/hooks/usePlatformStatus';

const mockFetch = (impl: unknown) => {
  Object.defineProperty(globalThis, 'fetch', {
    value: impl,
    configurable: true,
    writable: true,
  });
};

const clearFetch = () => {
  Reflect.deleteProperty(globalThis as unknown as Record<string, unknown>, 'fetch');
};

afterEach(() => clearFetch());

describe('getPlatformStatusState', () => {
  it('maps every known status to its label and tone', () => {
    expect(getPlatformStatusState('operational')).toEqual({
      label: 'All systems operational',
      tone: 'success',
    });
    expect(getPlatformStatusState('major_outage').tone).toBe('danger');
    expect(getPlatformStatusState('under_maintenance').tone).toBe('warning');
  });

  it('falls back to unknown for a non-string or unrecognised status', () => {
    expect(getPlatformStatusState(undefined)).toEqual(platformStatusByValue.unknown);
    expect(getPlatformStatusState(42)).toEqual(platformStatusByValue.unknown);
    expect(getPlatformStatusState('something-new')).toEqual(platformStatusByValue.unknown);
  });
});

describe('usePlatformStatus', () => {
  it('starts unknown rather than claiming health before the first response', () => {
    mockFetch(() => new Promise(() => {}));
    const { result } = renderHook(() => usePlatformStatus());
    expect(result.current).toEqual(platformStatusByValue.unknown);
  });

  it('reports the live status once the feed responds', async () => {
    mockFetch(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'operational' }) })
    );
    const { result } = renderHook(() => usePlatformStatus());
    await waitFor(() => expect(result.current.label).toBe('All systems operational'));
    expect(result.current.tone).toBe('success');
  });

  it('surfaces a degraded status instead of masking it', async () => {
    mockFetch(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'partial_outage' }) })
    );
    const { result } = renderHook(() => usePlatformStatus());
    await waitFor(() => expect(result.current.tone).toBe('danger'));
    expect(result.current.label).toBe('Partial outage');
  });

  it('degrades to unknown on a non-ok response', async () => {
    mockFetch(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }));
    const { result } = renderHook(() => usePlatformStatus());
    await waitFor(() => expect(result.current).toEqual(platformStatusByValue.unknown));
  });

  it('degrades to unknown when the request rejects', async () => {
    mockFetch(() => Promise.reject(new Error('offline')));
    const { result } = renderHook(() => usePlatformStatus());
    await waitFor(() => expect(result.current).toEqual(platformStatusByValue.unknown));
  });

  it('stays unknown where fetch is unavailable instead of throwing', () => {
    clearFetch();
    const { result } = renderHook(() => usePlatformStatus());
    expect(result.current).toEqual(platformStatusByValue.unknown);
  });

  it('does not set state after unmount', async () => {
    let resolve: (v: unknown) => void = () => {};
    mockFetch(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );
    const { unmount } = renderHook(() => usePlatformStatus());
    unmount();
    resolve({ ok: true, json: () => Promise.resolve({ status: 'operational' }) });
    await Promise.resolve();
  });
});
