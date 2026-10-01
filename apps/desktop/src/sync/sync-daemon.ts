'use strict';

import type { Mutation, SyncQueue } from './sync-queue';
import type { DesktopLogger } from '../utils/logger';

export type OnlineStatus = 'online' | 'offline';

export interface SyncDaemon {
  start: () => void;
  stop: () => void;
  getStatus: () => {
    running: boolean;
    online: OnlineStatus;
    pendingCount: number;
  };
}

export interface SyncTransport {
  send: (mutation: {
    type: string;
    entityType: string;
    entityId: string;
    data: Record<string, unknown> | null;
  }) => Promise<{ ok: boolean; error?: string }>;
}

interface SyncDaemonDeps {
  queue: SyncQueue;
  transport: SyncTransport;
  isOnline: () => boolean;
  onOnline: (callback: () => void) => void;
  onOffline: (callback: () => void) => void;
  logger: DesktopLogger;
  flushIntervalMs?: number;
}

export const createSyncDaemon = (deps: SyncDaemonDeps): SyncDaemon => {
  let running = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let currentStatus: OnlineStatus = deps.isOnline() ? 'online' : 'offline';

  // Sends batch[index] and then the rest, one at a time and in queue order: a
  // later change to a record must never reach the server before an earlier
  // one. Each send starts as soon as the one before it has settled.
  const sendFrom = async (batch: Mutation[], index: number): Promise<void> => {
    const mutation = batch[index];
    if (!mutation) return;
    try {
      const result = await deps.transport.send({
        type: mutation.type,
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        data: mutation.data,
      });

      if (result.ok) {
        deps.queue.pop(mutation.id);
        deps.logger.debug('sync_mutation_success', { id: mutation.id });
      } else {
        deps.queue.markFailed(mutation.id);
        deps.logger.warn('sync_mutation_failed', {
          id: mutation.id,
          error: result.error,
        });
      }
    } catch (error) {
      deps.queue.markFailed(mutation.id);
      deps.logger.warn('sync_mutation_error', { id: mutation.id, error });
    }
    return sendFrom(batch, index + 1);
  };

  const flush = async (): Promise<void> => {
    if (!deps.isOnline()) return;
    const batch = deps.queue.peek(10);
    if (batch.length === 0) return;

    deps.logger.debug('sync_daemon_flush', { batchSize: batch.length });

    await sendFrom(batch, 0);
  };

  const start = (): void => {
    if (running) return;
    running = true;
    deps.logger.info('sync_daemon_started');

    deps.onOnline(() => {
      currentStatus = 'online';
      deps.logger.info('sync_daemon_online');
      if (deps.queue.size() > 0) {
        void flush();
      }
    });

    deps.onOffline(() => {
      currentStatus = 'offline';
      deps.logger.info('sync_daemon_offline');
    });

    const interval = deps.flushIntervalMs ?? 30_000;
    timer = setInterval(() => {
      if (deps.isOnline() && deps.queue.size() > 0) {
        void flush();
      }
    }, interval);
  };

  const stop = (): void => {
    running = false;
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    deps.logger.info('sync_daemon_stopped');
  };

  const getStatus = (): {
    running: boolean;
    online: OnlineStatus;
    pendingCount: number;
  } => ({
    running,
    online: currentStatus,
    pendingCount: deps.queue.size(),
  });

  return { start, stop, getStatus };
};
