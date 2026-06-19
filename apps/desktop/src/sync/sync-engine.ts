'use strict';

import type { OfflineStore } from './offline-store';

export interface SyncTableConfig {
  name: string;
  primaryKey?: string;
  serverTimestampField?: string;
}

export interface SyncResult {
  table: string;
  pushed: number;
  pulled: number;
  errors: string[];
}

export interface SyncEngine {
  pushDirtyRows: (table: string) => Promise<SyncResult>;
  pullChanges: (table: string, sinceTimestamp?: number) => Promise<SyncResult>;
  fullSync: (tables: string[]) => Promise<SyncResult[]>;
  getLastSyncTimestamps: () => Record<string, number>;
  setLastSyncTimestamps: (timestamps: Record<string, number>) => void;
}

export interface SyncTransport {
  fetchChanges: (table: string, since: number) => Promise<Record<string, unknown>[]>;
  upsertRows: (
    table: string,
    rows: Record<string, unknown>[]
  ) => Promise<{ success: boolean; errors?: string[] }>;
  now?: () => number;
}

interface EngineDeps {
  store: OfflineStore;
  transport: SyncTransport;
  now?: () => number;
  initialSyncTimestamps?: Record<string, number>;
}

export const createSyncEngine = (deps: EngineDeps): SyncEngine => {
  const now = deps.now || (() => Date.now());
  const lastSyncAt: Record<string, number> = { ...deps.initialSyncTimestamps };

  const pushDirtyRows = async (table: string): Promise<SyncResult> => {
    const result: SyncResult = { table, pushed: 0, pulled: 0, errors: [] };
    try {
      const dirtyRows = deps.store.getDirtyRows(table);
      if (dirtyRows.length === 0) return result;

      const rowsToPush = dirtyRows.map(stripMeta);

      const serverResult = await deps.transport.upsertRows(table, rowsToPush);
      if (serverResult.success) {
        const ids = dirtyRows.map((r) => String(r.id));
        deps.store.markSynced(table, ids);
        result.pushed = ids.length;
      } else {
        result.errors = serverResult.errors || ['Unknown server error'];
      }
    } catch (err) {
      result.errors = [String(err)];
    }
    return result;
  };

  const pullChanges = async (table: string, sinceTimestamp?: number): Promise<SyncResult> => {
    const result: SyncResult = { table, pushed: 0, pulled: 0, errors: [] };
    try {
      const since = sinceTimestamp ?? lastSyncAt[table] ?? 0;
      const serverRows = await deps.transport.fetchChanges(table, since);
      if (serverRows.length === 0) return result;

      deps.store.upsert(table, serverRows.map(addMeta));
      result.pulled = serverRows.length;
    } catch (err) {
      result.errors = [String(err)];
    }
    return result;
  };

  const fullSync = async (tables: string[]): Promise<SyncResult[]> => {
    const results: SyncResult[] = [];
    for (const table of tables) {
      const pushResult = await pushDirtyRows(table);
      const since = lastSyncAt[table] ?? 0;
      const pullResult = await pullChanges(table, since);
      if (pullResult.errors.length === 0) {
        lastSyncAt[table] = now();
      }
      results.push({
        table,
        pushed: pushResult.pushed,
        pulled: pullResult.pulled,
        errors: [...pushResult.errors, ...pullResult.errors].filter(Boolean),
      });
    }
    return results;
  };

  const getLastSyncTimestamps = (): Record<string, number> => ({
    ...lastSyncAt,
  });
  const setLastSyncTimestamps = (timestamps: Record<string, number>): void => {
    for (const [key, val] of Object.entries(timestamps)) {
      lastSyncAt[key] = val;
    }
  };

  return {
    pushDirtyRows,
    pullChanges,
    fullSync,
    getLastSyncTimestamps,
    setLastSyncTimestamps,
  };
};

const META_FIELDS = new Set(['_dirty', '_synced_at']);

const stripMeta = (row: Record<string, unknown>): Record<string, unknown> => {
  const cleaned: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    if (!META_FIELDS.has(key)) cleaned[key] = val;
  }
  return cleaned;
};

const addMeta = (row: Record<string, unknown>): Record<string, unknown> => ({
  ...row,
  _dirty: 0,
  _synced_at: Date.now(),
});
