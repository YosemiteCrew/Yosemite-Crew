'use strict';

import type fs from 'node:fs';
import path from 'node:path';
import type { AuditLog } from './audit-log';
import { createJsonlStore, type DurableLogFs, type JsonlHealth } from './durable-log';

export type CsAction = 'dispense' | 'administer' | 'receive' | 'waste' | 'transfer' | 'inventory';

export interface CsTransaction {
  id: string;
  timestamp: number;
  action: CsAction;
  drugName: string;
  drugClass: string;
  lotNumber: string;
  quantity: number;
  unit: string;
  patientId?: string;
  patientName?: string;
  veterinarianId: string;
  veterinarianName: string;
  witnessId?: string;
  witnessName?: string;
  notes?: string;
  auditEntryId: string;
}

/**
 * Thrown when a controlled-substance transaction could not be persisted. The
 * caller must surface the failure: a dispense that is not on disk has not been
 * recorded, whatever the UI said.
 */
export class CsWriteError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'CsWriteError';
  }
}

export interface ControlledSubstanceLogbook {
  record: (tx: Omit<CsTransaction, 'id' | 'timestamp' | 'auditEntryId'>) => CsTransaction;
  getTransactions: (opts?: {
    drugName?: string;
    since?: number;
    limit?: number;
  }) => CsTransaction[];
  getByDrug: (drugName: string) => CsTransaction[];
  getByVeterinarian: (veterinarianId: string) => CsTransaction[];
  getInventory: (drugName?: string) => {
    drugName: string;
    totalReceived: number;
    totalDispensed: number;
    totalWasted: number;
    currentBalance: number;
  }[];
  getDailyLog: (date: Date) => CsTransaction[];
  getAuditTrail: () => ReturnType<AuditLog['query']>;
  size: () => number;
  /** Whether the register on disk can be trusted, and why not when it cannot. */
  getIntegrity: () => JsonlHealth;
}

interface CsDeps extends Partial<DurableLogFs> {
  auditLog: AuditLog;
  writeFileSync?: typeof fs.writeFileSync;
  now?: () => number;
}

const CS_LEGACY_FILENAME = 'controlled-substance-log.json';
const CS_FILENAME = 'controlled-substance-log.jsonl';

let txCounter = 0;
const generateTxId = (): string => `cs-${Date.now()}-${++txCounter}`;

const isCsTransaction = (value: unknown): value is CsTransaction => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.drugName === 'string';
};

export const createControlledSubstanceLogbook = (
  dirPath: string,
  deps: CsDeps
): ControlledSubstanceLogbook => {
  const now = deps.now || (() => Date.now());

  // Path-traversal guard: reject any ".." segment that would let dirPath escape
  // its intended location, while still allowing legitimate absolute data dirs.
  const blockedPath = path
    .normalize(path.join(dirPath, CS_FILENAME))
    .split(/[\\/]+/)
    .includes('..');

  const store = blockedPath
    ? null
    : createJsonlStore<CsTransaction>({
        dirPath,
        fileName: CS_FILENAME,
        legacyFileName: CS_LEGACY_FILENAME,
        isRecord: isCsTransaction,
        watermarkOf: (tx) => tx.id,
        fsq: deps,
        now,
      });

  const blockedHealth: JsonlHealth = {
    ok: false,
    reason: 'the log directory is not a permitted location, so no register is readable',
    quarantinePath: null,
    recordsLoaded: 0,
    watermarkCount: 0,
    tornTail: false,
  };

  const load = (): CsTransaction[] => (store ? store.readAll() : []);

  const record = (
    input: Omit<CsTransaction, 'id' | 'timestamp' | 'auditEntryId'>
  ): CsTransaction => {
    if (!store) {
      throw new CsWriteError(
        'refusing to record a controlled substance: the log directory is not a permitted location'
      );
    }

    // Generate the transaction id up front so it can be signed into the audit
    // entry's details. Mutating details after append() would invalidate the HMAC
    // signature and make the record read as tampered.
    const txId = generateTxId();
    const auditEntry = deps.auditLog.append({
      action: `cs:${input.action}`,
      actor: input.veterinarianId,
      resourceType: 'controlled-substance',
      resourceId: `${input.drugName}:${input.lotNumber}`,
      details: {
        csTransactionId: txId,
        drugName: input.drugName,
        drugClass: input.drugClass,
        lotNumber: input.lotNumber,
        quantity: input.quantity,
        unit: input.unit,
        patientId: input.patientId,
        veterinarianId: input.veterinarianId,
        witnessId: input.witnessId,
      },
    });

    const tx: CsTransaction = {
      ...input,
      id: txId,
      timestamp: now(),
      auditEntryId: auditEntry.id,
    };

    try {
      store.append(tx);
    } catch (error) {
      // The audit entry above is already signed and on disk, so the two
      // regulatory records would otherwise disagree forever. Surface the
      // failure instead of returning a transaction that exists nowhere.
      throw new CsWriteError(
        `failed to persist controlled-substance transaction ${txId}: ${(error as Error).message}`,
        error
      );
    }
    return tx;
  };

  const getTransactions = (opts?: {
    drugName?: string;
    since?: number;
    limit?: number;
  }): CsTransaction[] => {
    let entries = [...load()];
    if (opts?.drugName) {
      entries = entries.filter((e) => e.drugName === opts.drugName);
    }
    if (opts?.since) {
      entries = entries.filter((e) => e.timestamp >= opts.since!);
    }
    entries.sort((a, b) => b.timestamp - a.timestamp);
    if (opts?.limit && opts.limit > 0) {
      entries = entries.slice(0, opts.limit);
    }
    return entries;
  };

  const getByDrug = (drugName: string): CsTransaction[] => getTransactions({ drugName });

  const getByVeterinarian = (veterinarianId: string): CsTransaction[] =>
    load()
      .filter((e) => e.veterinarianId === veterinarianId)
      .sort((a, b) => b.timestamp - a.timestamp);

  const getInventory = (
    drugName?: string
  ): {
    drugName: string;
    totalReceived: number;
    totalDispensed: number;
    totalWasted: number;
    currentBalance: number;
  }[] => {
    const txs = drugName ? getTransactions({ drugName }) : getTransactions();
    const byDrug = new Map<string, { received: number; dispensed: number; wasted: number }>();

    for (const tx of txs) {
      if (!byDrug.has(tx.drugName)) {
        byDrug.set(tx.drugName, { received: 0, dispensed: 0, wasted: 0 });
      }
      const acc = byDrug.get(tx.drugName)!;
      if (tx.action === 'receive') acc.received += tx.quantity;
      else if (tx.action === 'dispense' || tx.action === 'administer') acc.dispensed += tx.quantity;
      else if (tx.action === 'waste') acc.wasted += tx.quantity;
    }

    return Array.from(byDrug.entries()).map(([name, acc]) => ({
      drugName: name,
      totalReceived: acc.received,
      totalDispensed: acc.dispensed,
      totalWasted: acc.wasted,
      currentBalance: acc.received - acc.dispensed - acc.wasted,
    }));
  };

  const getDailyLog = (date: Date): CsTransaction[] => {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const end = start + 86_400_000;
    return getTransactions({ since: start }).filter((tx) => tx.timestamp < end);
  };

  const getAuditTrail = (): ReturnType<AuditLog['query']> =>
    deps.auditLog.query({ resourceType: 'controlled-substance' });

  const size = (): number => load().length;

  const getIntegrity = (): JsonlHealth => (store ? store.health() : blockedHealth);

  return {
    record,
    getTransactions,
    getByDrug,
    getByVeterinarian,
    getInventory,
    getDailyLog,
    getAuditTrail,
    size,
    getIntegrity,
  };
};
