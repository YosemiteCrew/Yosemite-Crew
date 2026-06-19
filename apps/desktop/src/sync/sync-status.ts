'use strict';

export type SyncState = 'not-ready' | 'offline' | 'blocked' | 'pending' | 'idle' | 'error';

export interface SyncDaemonStatus {
  running: boolean;
  online: 'online' | 'offline';
  pendingCount: number;
}

export interface SyncStatusInput {
  engineReady: boolean;
  endpointConfigured: boolean;
  daemonStatus?: SyncDaemonStatus | null;
  dirtyCounts?: Record<string, number>;
  lastSyncTimestamps?: Record<string, number>;
  lastError?: string | null;
}

export interface SyncStatusSummary {
  state: SyncState;
  engineReady: boolean;
  endpointConfigured: boolean;
  online: boolean;
  pendingMutations: number;
  dirtyRows: number;
  dirtyCounts: Record<string, number>;
  lastSyncTimestamps: Record<string, number>;
  lastError: string | null;
}

export const summarizeSyncStatus = (input: SyncStatusInput): SyncStatusSummary => {
  const dirtyCounts = input.dirtyCounts || {};
  const dirtyRows = Object.values(dirtyCounts).reduce((sum, val) => sum + Math.max(0, val || 0), 0);
  const pendingMutations = input.daemonStatus?.pendingCount ?? 0;
  const online = input.daemonStatus ? input.daemonStatus.online === 'online' : true;
  const lastError = input.lastError || null;

  let state: SyncState = 'idle';
  if (!input.engineReady) state = 'not-ready';
  else if (!online) state = 'offline';
  else if (lastError) state = 'error';
  else if (!input.endpointConfigured && (dirtyRows > 0 || pendingMutations > 0)) state = 'blocked';
  else if (dirtyRows > 0 || pendingMutations > 0) state = 'pending';

  return {
    state,
    engineReady: input.engineReady,
    endpointConfigured: input.endpointConfigured,
    online,
    pendingMutations,
    dirtyRows,
    dirtyCounts: { ...dirtyCounts },
    lastSyncTimestamps: { ...input.lastSyncTimestamps },
    lastError,
  };
};
