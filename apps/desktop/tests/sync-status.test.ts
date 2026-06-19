import { summarizeSyncStatus } from '../src/sync/sync-status';

describe('summarizeSyncStatus', () => {
  test('reports not-ready when the engine is not initialized', () => {
    expect(summarizeSyncStatus({ engineReady: false, endpointConfigured: false }).state).toBe(
      'not-ready'
    );
  });

  test('reports offline before endpoint or pending states', () => {
    const status = summarizeSyncStatus({
      engineReady: true,
      endpointConfigured: true,
      daemonStatus: { running: true, online: 'offline', pendingCount: 2 },
      dirtyCounts: { mutations: 3 },
    });
    expect(status.state).toBe('offline');
    expect(status.online).toBe(false);
    expect(status.pendingMutations).toBe(2);
    expect(status.dirtyRows).toBe(3);
  });

  test('reports blocked when local changes exist without a backend endpoint', () => {
    const status = summarizeSyncStatus({
      engineReady: true,
      endpointConfigured: false,
      daemonStatus: { running: true, online: 'online', pendingCount: 0 },
      dirtyCounts: { mutations: 1 },
    });
    expect(status.state).toBe('blocked');
  });

  test('reports pending when local changes can sync', () => {
    const status = summarizeSyncStatus({
      engineReady: true,
      endpointConfigured: true,
      daemonStatus: { running: true, online: 'online', pendingCount: 2 },
      dirtyCounts: { mutations: 1 },
    });
    expect(status.state).toBe('pending');
    expect(status.dirtyRows).toBe(1);
    expect(status.pendingMutations).toBe(2);
  });

  test('reports idle with timestamps when no local work remains', () => {
    const status = summarizeSyncStatus({
      engineReady: true,
      endpointConfigured: true,
      daemonStatus: { running: true, online: 'online', pendingCount: 0 },
      lastSyncTimestamps: { mutations: 1234 },
    });
    expect(status.state).toBe('idle');
    expect(status.lastSyncTimestamps).toEqual({ mutations: 1234 });
  });

  test('reports error when the last sync failed', () => {
    const status = summarizeSyncStatus({
      engineReady: true,
      endpointConfigured: true,
      lastError: 'network failed',
    });
    expect(status.state).toBe('error');
    expect(status.lastError).toBe('network failed');
  });
});
