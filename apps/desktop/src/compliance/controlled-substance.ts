'use strict';

import fs from 'node:fs';
import path from 'node:path';
import type { AuditLog } from './audit-log';

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
}

interface CsDeps {
  auditLog: AuditLog;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  existsSync?: typeof fs.existsSync;
  now?: () => number;
}

const CS_FILENAME = 'controlled-substance-log.json';

let txCounter = 0;
const generateTxId = (): string => `cs-${Date.now()}-${++txCounter}`;

export const createControlledSubstanceLogbook = (
  dirPath: string,
  deps: CsDeps
): ControlledSubstanceLogbook => {
  const readFileSync = deps.readFileSync || fs.readFileSync;
  const writeFileSync = deps.writeFileSync || fs.writeFileSync;
  const mkdirSync = deps.mkdirSync || fs.mkdirSync;
  const existsSync = deps.existsSync || fs.existsSync;
  const now = deps.now || (() => Date.now());
  const filePath = path.join(dirPath, CS_FILENAME);

  const load = (): CsTransaction[] => {
    try {
      if (!existsSync(filePath)) return [];
      const raw = readFileSync(filePath, 'utf8');
      const entries: CsTransaction[] = JSON.parse(raw);
      if (!Array.isArray(entries)) return [];
      return entries.filter((e) => typeof e.id === 'string' && typeof e.drugName === 'string');
    } catch {
      return [];
    }
  };

  const save = (entries: CsTransaction[]): void => {
    try {
      mkdirSync(dirPath, { recursive: true });
      writeFileSync(filePath, JSON.stringify(entries), 'utf8');
    } catch {
      // persist must never break the app
    }
  };

  const record = (
    input: Omit<CsTransaction, 'id' | 'timestamp' | 'auditEntryId'>
  ): CsTransaction => {
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

    const entries = load();
    entries.push(tx);
    save(entries);
    return tx;
  };

  const getTransactions = (opts?: {
    drugName?: string;
    since?: number;
    limit?: number;
  }): CsTransaction[] => {
    let entries = load();
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

  return {
    record,
    getTransactions,
    getByDrug,
    getByVeterinarian,
    getInventory,
    getDailyLog,
    getAuditTrail,
    size,
  };
};
