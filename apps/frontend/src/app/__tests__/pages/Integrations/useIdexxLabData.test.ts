import { act, renderHook, waitFor } from '@testing-library/react';
import { useIdexxLabData } from '@/app/features/integrations/pages/Integrations/useIdexxLabData';

const listIdexxIvlsDevicesMock = jest.fn();
const listIdexxOrdersMock = jest.fn();

jest.mock('@/app/features/integrations/services/idexxService', () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
  listIdexxIvlsDevices: (...args: any[]) => listIdexxIvlsDevicesMock(...args),
  listIdexxOrders: (...args: any[]) => listIdexxOrdersMock(...args),
}));

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const ENABLED = {
  primaryOrgId: 'org-1',
  canViewLabs: true,
  idexxStatus: 'enabled',
};

describe('useIdexxLabData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listIdexxIvlsDevicesMock.mockResolvedValue({ ivlsDeviceList: [{ id: 'ivls-1' }] });
    listIdexxOrdersMock.mockResolvedValue([{ id: 'order-1' }]);
  });

  it('loads devices and the three most recent orders when IDEXX is enabled', async () => {
    const { result } = renderHook(() => useIdexxLabData(ENABLED));

    await waitFor(() => expect(result.current.devices).toEqual([{ id: 'ivls-1' }]));
    expect(result.current.recentOrders).toEqual([{ id: 'order-1' }]);
    expect(result.current.deviceError).toBeNull();
    expect(listIdexxIvlsDevicesMock).toHaveBeenCalledWith('org-1');
    expect(listIdexxOrdersMock).toHaveBeenCalledWith({ organisationId: 'org-1', limit: 3 });
  });

  it('treats a reply with no device list as no devices', async () => {
    listIdexxIvlsDevicesMock.mockResolvedValue({});

    const { result } = renderHook(() => useIdexxLabData(ENABLED));

    await waitFor(() => expect(result.current.recentOrders).toEqual([{ id: 'order-1' }]));
    expect(result.current.devices).toEqual([]);
    expect(result.current.deviceError).toBeNull();
  });

  it('reads nothing until an organisation is selected', async () => {
    const { result } = renderHook(() => useIdexxLabData({ ...ENABLED, primaryOrgId: null }));

    await waitFor(() => expect(listIdexxIvlsDevicesMock).not.toHaveBeenCalled());
    expect(result.current.devices).toEqual([]);
    expect(result.current.recentOrders).toEqual([]);
  });

  it.each([
    ['the viewer cannot see labs', { ...ENABLED, canViewLabs: false }],
    ['the integration is not enabled', { ...ENABLED, idexxStatus: 'disabled' }],
  ])('reads nothing when %s', async (_label, args) => {
    const { result } = renderHook(() => useIdexxLabData(args));

    await waitFor(() => expect(result.current.devices).toEqual([]));
    expect(result.current.recentOrders).toEqual([]);
    expect(listIdexxIvlsDevicesMock).not.toHaveBeenCalled();
    expect(listIdexxOrdersMock).not.toHaveBeenCalled();
  });

  it('reports a failed device read and still tries the orders read', async () => {
    listIdexxIvlsDevicesMock.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useIdexxLabData(ENABLED));

    await waitFor(() =>
      expect(result.current.deviceError).toBe('Unable to load linked IDEXX devices.')
    );
    expect(result.current.devices).toEqual([]);
    expect(result.current.recentOrders).toEqual([{ id: 'order-1' }]);
  });

  it('swallows a failed orders read without raising an error', async () => {
    listIdexxOrdersMock.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useIdexxLabData(ENABLED));

    await waitFor(() => expect(result.current.devices).toEqual([{ id: 'ivls-1' }]));
    expect(result.current.recentOrders).toEqual([]);
    expect(result.current.deviceError).toBeNull();
  });

  it('ignores a device reply that arrives after the organisation changed', async () => {
    const stale = deferred<{ ivlsDeviceList: unknown[] }>();
    listIdexxIvlsDevicesMock.mockReturnValueOnce(stale.promise);

    const { result, rerender } = renderHook(
      (args: Parameters<typeof useIdexxLabData>[0]) => useIdexxLabData(args),
      { initialProps: ENABLED }
    );

    // Second organisation: its reply resolves first and wins.
    listIdexxIvlsDevicesMock.mockResolvedValue({ ivlsDeviceList: [{ id: 'ivls-2' }] });
    rerender({ ...ENABLED, primaryOrgId: 'org-2' });
    await waitFor(() => expect(result.current.devices).toEqual([{ id: 'ivls-2' }]));

    await act(async () => {
      stale.resolve({ ivlsDeviceList: [{ id: 'ivls-1' }] });
      await stale.promise;
    });

    expect(result.current.devices).toEqual([{ id: 'ivls-2' }]);
  });

  it('ignores a device rejection that arrives after the organisation changed', async () => {
    const stale = deferred<{ ivlsDeviceList: unknown[] }>();
    listIdexxIvlsDevicesMock.mockReturnValueOnce(stale.promise);

    const { result, rerender } = renderHook(
      (args: Parameters<typeof useIdexxLabData>[0]) => useIdexxLabData(args),
      { initialProps: ENABLED }
    );

    listIdexxIvlsDevicesMock.mockResolvedValue({ ivlsDeviceList: [{ id: 'ivls-2' }] });
    rerender({ ...ENABLED, primaryOrgId: 'org-2' });
    await waitFor(() => expect(result.current.devices).toEqual([{ id: 'ivls-2' }]));

    await act(async () => {
      stale.reject(new Error('too late'));
      await stale.promise.catch(() => undefined);
    });

    expect(result.current.deviceError).toBeNull();
    expect(result.current.devices).toEqual([{ id: 'ivls-2' }]);
  });

  it('ignores an orders reply that arrives after the organisation changed', async () => {
    const staleOrders = deferred<unknown[]>();
    listIdexxIvlsDevicesMock.mockResolvedValueOnce({ ivlsDeviceList: [{ id: 'ivls-1' }] });
    listIdexxOrdersMock.mockReturnValueOnce(staleOrders.promise);

    const { result, rerender } = renderHook(
      (args: Parameters<typeof useIdexxLabData>[0]) => useIdexxLabData(args),
      { initialProps: ENABLED }
    );

    // The first run is now parked on its orders read.
    await waitFor(() => expect(result.current.devices).toEqual([{ id: 'ivls-1' }]));

    listIdexxIvlsDevicesMock.mockResolvedValue({ ivlsDeviceList: [{ id: 'ivls-2' }] });
    listIdexxOrdersMock.mockResolvedValue([{ id: 'order-2' }]);
    rerender({ ...ENABLED, primaryOrgId: 'org-2' });
    await waitFor(() => expect(result.current.recentOrders).toEqual([{ id: 'order-2' }]));

    await act(async () => {
      staleOrders.resolve([{ id: 'order-1' }]);
      await staleOrders.promise;
    });

    expect(result.current.recentOrders).toEqual([{ id: 'order-2' }]);
  });

  it('ignores an orders rejection that arrives after the organisation changed', async () => {
    const staleOrders = deferred<unknown[]>();
    listIdexxIvlsDevicesMock.mockResolvedValueOnce({ ivlsDeviceList: [{ id: 'ivls-1' }] });
    listIdexxOrdersMock.mockReturnValueOnce(staleOrders.promise);

    const { result, rerender } = renderHook(
      (args: Parameters<typeof useIdexxLabData>[0]) => useIdexxLabData(args),
      { initialProps: ENABLED }
    );

    await waitFor(() => expect(result.current.devices).toEqual([{ id: 'ivls-1' }]));

    listIdexxIvlsDevicesMock.mockResolvedValue({ ivlsDeviceList: [{ id: 'ivls-2' }] });
    listIdexxOrdersMock.mockResolvedValue([{ id: 'order-2' }]);
    rerender({ ...ENABLED, primaryOrgId: 'org-2' });
    await waitFor(() => expect(result.current.recentOrders).toEqual([{ id: 'order-2' }]));

    await act(async () => {
      staleOrders.reject(new Error('too late'));
      await staleOrders.promise.catch(() => undefined);
    });

    expect(result.current.recentOrders).toEqual([{ id: 'order-2' }]);
  });
});
