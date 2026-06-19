'use strict';

import type { AuditLog } from './audit-log';

export interface OfflineAuditTrail {
  logMutation: (mutation: {
    id: string;
    type: string;
    entityType: string;
    entityId: string;
    action: string;
  }) => void;
  getOfflineMutations: (since?: number) => OfflineMutationRecord[];
  getUnsyncedCount: () => number;
  getSyncFailureCount: () => number;
}

export interface OfflineMutationRecord {
  mutationId: string;
  entityType: string;
  entityId: string;
  action: string;
  offlineTimestamp: number;
  syncedAt: number | null;
  failedAt: number | null;
  retryCount: number;
}

interface TrailDeps {
  auditLog: AuditLog;
  now?: () => number;
}

export const createOfflineAuditTrail = (deps: TrailDeps): OfflineAuditTrail => {
  const now = deps.now || (() => Date.now());

  const logMutation = (mutation: {
    id: string;
    type: string;
    entityType: string;
    entityId: string;
    action: string;
  }): void => {
    deps.auditLog.append({
      action: `offline:${mutation.action || mutation.type}`,
      actor: 'offline-system',
      resourceType: mutation.entityType,
      resourceId: mutation.entityId,
      details: {
        mutationId: mutation.id,
        offlineTimestamp: now(),
        mutationType: mutation.type,
      },
    });
  };

  const getOfflineMutations = (since?: number): OfflineMutationRecord[] => {
    const entries = deps.auditLog.query(since ? { since } : undefined);

    return entries
      .filter((e) => e.action.startsWith('offline:'))
      .map((e) => ({
        mutationId: e.details.mutationId as string,
        entityType: e.resourceType,
        entityId: e.resourceId,
        action: e.action.replace('offline:', ''),
        offlineTimestamp: (e.details.offlineTimestamp as number) || e.timestamp,
        syncedAt: (e.details.syncedAt as number) || null,
        failedAt: (e.details.failedAt as number) || null,
        retryCount: (e.details.retryCount as number) || 0,
      }));
  };

  const getUnsyncedCount = (): number =>
    getOfflineMutations().filter((m) => m.syncedAt === null && m.failedAt === null).length;

  const getSyncFailureCount = (): number =>
    getOfflineMutations().filter((m) => m.failedAt !== null).length;

  return {
    logMutation,
    getOfflineMutations,
    getUnsyncedCount,
    getSyncFailureCount,
  };
};
