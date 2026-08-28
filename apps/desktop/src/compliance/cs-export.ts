'use strict';

import fs from 'node:fs';
import path from 'node:path';
import type { ControlledSubstanceLogbook } from './controlled-substance';

export interface CsDailyExportService {
  exportDailyLog: (date?: Date) => { filePath: string; rowCount: number } | null;
  exportRange: (start: Date, end: Date) => { filePath: string; rowCount: number } | null;
  getExportDir: () => string;
  setExportDir: (dir: string) => void;
  getExportHistory: () => CsExportRecord[];
}

export interface CsExportRecord {
  filePath: string;
  date: string;
  rowCount: number;
  exportedAt: number;
}

interface ExportDeps {
  logbook: ControlledSubstanceLogbook;
  exportDir: string;
  now?: () => number;
  writeFile?: typeof fs.writeFileSync;
  mkdir?: typeof fs.mkdirSync;
}

const generateCsv = (
  rows: {
    timestamp: number;
    action: string;
    drugName: string;
    drugClass: string;
    lotNumber: string;
    quantity: number;
    unit: string;
    patientId?: string;
    patientName?: string;
    veterinarianName: string;
    witnessName?: string;
    witnessPinVerified?: boolean;
    notes?: string;
  }[]
): string => {
  // "Witness" on its own presents a claimed name as a verified one: a
  // destruction nobody witnessed reads identically to one a second person
  // authenticated. The status is its own column so the CSV cannot imply a
  // verification that did not happen.
  const header =
    'Date,Time,Action,Drug Name,Drug Class,Lot #,Quantity,Unit,Patient ID,Patient Name,Veterinarian,Witness,Witness Verified,Notes';
  const lines = rows.map((r) => {
    const d = new Date(r.timestamp);
    const date = d.toISOString().split('T')[0] || '';
    const time = d.toTimeString().split(' ')[0] || '';
    return [
      date,
      time,
      r.action,
      r.drugName,
      r.drugClass,
      r.lotNumber,
      r.quantity,
      r.unit,
      r.patientId || '',
      r.patientName || '',
      r.veterinarianName,
      r.witnessName || '',
      r.witnessPinVerified === true ? 'yes' : 'no',
      r.notes || '',
    ]
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
      .join(',');
  });
  return [header, ...lines].join('\n');
};

export const createCsDailyExport = (deps: ExportDeps): CsDailyExportService => {
  const now = deps.now || (() => Date.now());
  const writeFile = deps.writeFile || fs.writeFileSync;
  const mkdir = deps.mkdir || fs.mkdirSync;
  let exportDir = deps.exportDir;
  const history: CsExportRecord[] = [];

  const ensureDir = (): void => {
    try {
      mkdir(exportDir, { recursive: true });
    } catch {
      // silently fail
    }
  };

  const exportDailyLog = (date?: Date): { filePath: string; rowCount: number } | null => {
    const targetDate = date || new Date();
    const rows = deps.logbook.getDailyLog(targetDate);
    if (rows.length === 0) return null;

    ensureDir();
    const dateStr = targetDate.toISOString().split('T')[0] || '';
    const base = path.resolve(exportDir);
    const target = path.resolve(base, `cs-daily-${dateStr}.csv`);
    const relative = path.relative(base, target);
    if (relative.startsWith('..')) {
      throw new Error('Invalid file path');
    }
    const filePath = target;
    const csv = generateCsv(rows);
    writeFile(filePath, csv, 'utf8');

    const record: CsExportRecord = {
      filePath,
      date: dateStr,
      rowCount: rows.length,
      exportedAt: now(),
    };
    history.push(record);
    return { filePath, rowCount: rows.length };
  };

  const exportRange = (start: Date, end: Date): { filePath: string; rowCount: number } | null => {
    const startTs = start.getTime();
    const endTs = end.getTime();
    const all = deps.logbook
      .getTransactions({ since: startTs })
      .filter((tx) => tx.timestamp <= endTs);
    if (all.length === 0) return null;

    ensureDir();
    const startStr = start.toISOString().split('T')[0] || '';
    const endStr = end.toISOString().split('T')[0] || '';
    const base = path.resolve(exportDir);
    const target = path.resolve(base, `cs-range-${startStr}_${endStr}.csv`);
    const relative = path.relative(base, target);
    if (relative.startsWith('..')) {
      throw new Error('Invalid file path');
    }
    const filePath = target;
    const csv = generateCsv(all);
    writeFile(filePath, csv, 'utf8');

    const record: CsExportRecord = {
      filePath,
      date: `${startStr}_${endStr}`,
      rowCount: all.length,
      exportedAt: now(),
    };
    history.push(record);
    return { filePath, rowCount: all.length };
  };

  const getExportDir = (): string => exportDir;
  const setExportDir = (dir: string): void => {
    exportDir = dir;
  };
  const getExportHistory = (): CsExportRecord[] => [...history];

  return {
    exportDailyLog,
    exportRange,
    getExportDir,
    setExportDir,
    getExportHistory,
  };
};
