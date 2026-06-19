import { createSyncDaemon } from '../src/sync/sync-daemon';
import type { SyncQueue } from '../src/sync/sync-queue';
import type { SyncTransport } from '../src/sync/sync-daemon';
import type { DesktopLogger } from '../src/utils/logger';

const dummyMutation = {
  id: 'm1',
  type: 'create' as const,
  entityType: 'patient',
  entityId: 'p1',
  data: { name: 'Buddy' },
  timestamp: 100,
  retryCount: 0,
};

describe('createSyncDaemon', () => {
  let queue: jest.Mocked<SyncQueue>;
  let transport: jest.Mocked<SyncTransport>;
  let isOnline: jest.Mock;
  let onOnline: jest.Mock;
  let onOffline: jest.Mock;
  let logger: jest.Mocked<DesktopLogger>;
  let daemon: ReturnType<typeof createSyncDaemon>;
  let onlineCb: () => void;
  let offlineCb: () => void;

  beforeEach(() => {
    jest.useFakeTimers();
    queue = {
      peek: jest.fn().mockReturnValue([]),
      pop: jest.fn().mockReturnValue(true),
      markFailed: jest.fn(),
      size: jest.fn().mockReturnValue(0),
      push: jest.fn(),
      getFailed: jest.fn(),
      getPending: jest.fn(),
      clear: jest.fn(),
      getAll: jest.fn(),
    };
    transport = { send: jest.fn().mockResolvedValue({ ok: true }) };
    isOnline = jest.fn().mockReturnValue(true);
    onlineCb = () => {};
    offlineCb = () => {};
    onOnline = jest.fn((cb: () => void) => {
      onlineCb = cb;
    });
    onOffline = jest.fn((cb: () => void) => {
      offlineCb = cb;
    });
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    daemon = createSyncDaemon({
      queue,
      transport,
      isOnline,
      onOnline,
      onOffline,
      logger,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('start', () => {
    it('sets running to true and logs', () => {
      daemon.start();
      expect(daemon.getStatus().running).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('sync_daemon_started');
      expect(onOnline).toHaveBeenCalled();
      expect(onOffline).toHaveBeenCalled();
    });

    it('is idempotent', () => {
      daemon.start();
      daemon.start();
      expect(onOnline).toHaveBeenCalledTimes(1);
      expect(onOffline).toHaveBeenCalledTimes(1);
    });

    it('initial status is online when isOnline returns true', () => {
      daemon.start();
      expect(daemon.getStatus().online).toBe('online');
    });

    it('initial status is offline when isOnline returns false', () => {
      isOnline.mockReturnValue(false);
      daemon = createSyncDaemon({
        queue,
        transport,
        isOnline,
        onOnline,
        onOffline,
        logger,
      });
      daemon.start();
      expect(daemon.getStatus().online).toBe('offline');
    });
  });

  describe('stop', () => {
    it('sets running to false and logs', () => {
      daemon.start();
      daemon.stop();
      expect(daemon.getStatus().running).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('sync_daemon_stopped');
    });

    it('is safe when not started (timer is null)', () => {
      expect(() => daemon.stop()).not.toThrow();
      expect(daemon.getStatus().running).toBe(false);
    });

    it('clears the interval', () => {
      daemon.start();
      jest.advanceTimersByTime(60000);
      const beforeCount = transport.send.mock.calls.length;

      daemon.stop();
      jest.advanceTimersByTime(60000);

      expect(transport.send.mock.calls.length).toBe(beforeCount);
    });
  });

  describe('getStatus', () => {
    it('returns running state, online status, and pending count', () => {
      queue.size.mockReturnValue(5);
      daemon = createSyncDaemon({
        queue,
        transport,
        isOnline,
        onOnline,
        onOffline,
        logger,
      });
      daemon.start();
      expect(daemon.getStatus()).toEqual({
        running: true,
        online: 'online',
        pendingCount: 5,
      });
    });

    it('shows offline after offline callback fires', () => {
      daemon.start();
      expect(daemon.getStatus().online).toBe('online');
      offlineCb();
      expect(daemon.getStatus().online).toBe('offline');
    });
  });

  describe('flush via online callback', () => {
    it('returns early when offline', async () => {
      isOnline.mockReturnValue(false);
      daemon.start();
      onlineCb();
      await Promise.resolve();
      expect(transport.send).not.toHaveBeenCalled();
    });

    it('returns early when queue is empty', async () => {
      queue.peek.mockReturnValue([]);
      daemon.start();
      onlineCb();
      await Promise.resolve();
      expect(transport.send).not.toHaveBeenCalled();
    });

    it('processes mutations and pops on success', async () => {
      queue.size.mockReturnValue(1);
      queue.peek.mockReturnValue([dummyMutation]);
      daemon.start();
      onlineCb();
      await Promise.resolve();
      expect(transport.send).toHaveBeenCalledWith({
        type: dummyMutation.type,
        entityType: dummyMutation.entityType,
        entityId: dummyMutation.entityId,
        data: dummyMutation.data,
      });
      expect(queue.pop).toHaveBeenCalledWith('m1');
    });

    it('marks failed when transport returns ok: false', async () => {
      queue.size.mockReturnValue(1);
      transport.send.mockResolvedValue({ ok: false, error: 'conflict' });
      queue.peek.mockReturnValue([dummyMutation]);
      daemon.start();
      onlineCb();
      await Promise.resolve();
      expect(queue.markFailed).toHaveBeenCalledWith('m1');
      expect(queue.pop).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('sync_mutation_failed', {
        id: 'm1',
        error: 'conflict',
      });
    });

    it('marks failed when transport.send throws', async () => {
      queue.size.mockReturnValue(1);
      transport.send.mockRejectedValue(new Error('network down'));
      queue.peek.mockReturnValue([dummyMutation]);
      daemon.start();
      onlineCb();
      await Promise.resolve();
      expect(queue.markFailed).toHaveBeenCalledWith('m1');
      expect(queue.pop).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('sync_mutation_error', {
        id: 'm1',
        error: new Error('network down'),
      });
    });

    it('processes multiple mutations in batch', async () => {
      queue.size.mockReturnValue(2);
      const m2 = { ...dummyMutation, id: 'm2' };
      queue.peek.mockReturnValue([dummyMutation, m2]);
      daemon.start();
      onlineCb();
      // Each mutation needs its own microtask flush
      await Promise.resolve();
      await Promise.resolve();
      expect(transport.send).toHaveBeenCalledTimes(2);
      expect(queue.pop).toHaveBeenCalledWith('m1');
      expect(queue.pop).toHaveBeenCalledWith('m2');
    });

    it('logs debug on success', async () => {
      queue.size.mockReturnValue(1);
      queue.peek.mockReturnValue([dummyMutation]);
      daemon.start();
      onlineCb();
      await Promise.resolve();
      expect(logger.debug).toHaveBeenCalledWith('sync_mutation_success', {
        id: 'm1',
      });
    });

    it('returns early at batch check when size > 0 but peek returns empty', async () => {
      queue.size.mockReturnValue(1);
      queue.peek.mockReturnValue([]);
      daemon.start();
      onlineCb();
      await Promise.resolve();
      // flush returns before logger.debug because batch is empty
      expect(transport.send).not.toHaveBeenCalled();
    });
  });

  describe('flush via interval', () => {
    it('triggers flush when online and queue has items', async () => {
      queue.size.mockReturnValue(1);
      queue.peek.mockReturnValue([dummyMutation]);
      daemon = createSyncDaemon({
        queue,
        transport,
        isOnline,
        onOnline,
        onOffline,
        logger,
        flushIntervalMs: 5000,
      });
      daemon.start();
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      expect(transport.send).toHaveBeenCalled();
    });

    it('does not flush when offline', () => {
      isOnline.mockReturnValue(false);
      queue.size.mockReturnValue(1);
      daemon = createSyncDaemon({
        queue,
        transport,
        isOnline,
        onOnline,
        onOffline,
        logger,
        flushIntervalMs: 5000,
      });
      daemon.start();
      jest.advanceTimersByTime(5000);
      expect(transport.send).not.toHaveBeenCalled();
    });

    it('does not flush when queue is empty', () => {
      isOnline.mockReturnValue(true);
      queue.size.mockReturnValue(0);
      daemon = createSyncDaemon({
        queue,
        transport,
        isOnline,
        onOnline,
        onOffline,
        logger,
        flushIntervalMs: 5000,
      });
      daemon.start();
      jest.advanceTimersByTime(5000);
      expect(transport.send).not.toHaveBeenCalled();
    });

    it('uses default flushIntervalMs of 30000 when not provided', () => {
      queue.size.mockReturnValue(1);
      queue.peek.mockReturnValue([dummyMutation]);
      daemon = createSyncDaemon({
        queue,
        transport,
        isOnline,
        onOnline,
        onOffline,
        logger,
      });
      daemon.start();
      jest.advanceTimersByTime(29999);
      expect(transport.send).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(transport.send).toHaveBeenCalled();
    });
  });

  describe('online/offline transitions', () => {
    it('online callback sets status to online and flushes when queue has items', async () => {
      daemon.start();
      isOnline.mockReturnValue(false);
      queue.size.mockReturnValue(1);
      queue.peek.mockReturnValue([dummyMutation]);
      isOnline.mockReturnValue(true);
      onlineCb();
      await Promise.resolve();
      expect(daemon.getStatus().online).toBe('online');
      expect(transport.send).toHaveBeenCalled();
    });

    it('online callback does not flush when queue is empty', async () => {
      daemon.start();
      isOnline.mockReturnValue(true);
      queue.size.mockReturnValue(0);
      daemon.start();
      onlineCb();
      await Promise.resolve();
      expect(transport.send).not.toHaveBeenCalled();
    });

    it('offline callback sets status to offline and logs', () => {
      daemon.start();
      offlineCb();
      expect(daemon.getStatus().online).toBe('offline');
      expect(logger.info).toHaveBeenCalledWith('sync_daemon_offline');
    });
  });
});
