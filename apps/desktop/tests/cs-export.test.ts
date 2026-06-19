'use strict';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createControlledSubstanceLogbook } from '../src/compliance/controlled-substance';
import { createCsDailyExport } from '../src/compliance/cs-export';
import type { AuditLog } from '../src/compliance/audit-log';

describe('createCsDailyExport', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-export-test-'));
  let testCounter = 0;

  const makeLogbook = (): ReturnType<typeof createControlledSubstanceLogbook> => {
    const dir = path.join(rootDir, `logbook-${++testCounter}`);
    fs.mkdirSync(dir, { recursive: true });
    const auditLog: AuditLog = {
      append: jest.fn((e) => ({
        ...e,
        id: `audit-${testCounter}`,
        timestamp: Date.now(),
        hash: 'abc',
        previousHash: '',
      })),
      query: jest.fn(() => []),
      get: jest.fn(),
      verify: jest.fn(() => ({ valid: true })),
      verifyAll: jest.fn(() => []),
      size: jest.fn(() => 0),
    };
    return createControlledSubstanceLogbook(dir, { auditLog });
  };

  afterAll(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  test('exportDailyLog writes CSV file with daily transactions', () => {
    const logbook = makeLogbook();
    const now = Date.now();
    logbook.record({
      action: 'dispense',
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'L001',
      quantity: 1,
      unit: 'ml',
      veterinarianId: 'vet-1',
      veterinarianName: 'Dr. Smith',
    });

    const exportDir = path.join(rootDir, `exports-${testCounter}`);
    const svc = createCsDailyExport({ logbook, exportDir, now: () => now });
    const result = svc.exportDailyLog(new Date(now));
    expect(result).not.toBeNull();
    expect(result!.rowCount).toBe(1);
    expect(fs.existsSync(result!.filePath)).toBe(true);

    const content = fs.readFileSync(result!.filePath, 'utf8');
    expect(content).toContain('Date,Time,Action,Drug Name');
    expect(content).toContain('Ketamine');
  });

  test('exportDailyLog returns null when no transactions for date', () => {
    const logbook = makeLogbook();
    const exportDir = path.join(rootDir, `exports-${testCounter}`);
    const svc = createCsDailyExport({ logbook, exportDir });
    const result = svc.exportDailyLog(new Date('2020-01-01'));
    expect(result).toBeNull();
  });

  test('exportRange writes CSV for date range', () => {
    const logbook = makeLogbook();
    const exportDir = path.join(rootDir, `exports-${testCounter}`);
    logbook.record({
      action: 'dispense',
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'L001',
      quantity: 1,
      unit: 'ml',
      veterinarianId: 'vet-1',
      veterinarianName: 'Dr. Smith',
    });
    logbook.record({
      action: 'receive',
      drugName: 'Torbugesic',
      drugClass: 'CIII',
      lotNumber: 'L002',
      quantity: 10,
      unit: 'ml',
      veterinarianId: 'vet-1',
      veterinarianName: 'Dr. Smith',
    });

    const svc = createCsDailyExport({ logbook, exportDir });
    const result = svc.exportRange(new Date('2020-01-01'), new Date('2030-01-01'));
    expect(result).not.toBeNull();
    expect(result!.rowCount).toBe(2);
  });

  test('exportRange returns null when no transactions in range', () => {
    const logbook = makeLogbook();
    const exportDir = path.join(rootDir, `exports-${testCounter}`);
    const svc = createCsDailyExport({ logbook, exportDir });
    const result = svc.exportRange(new Date('2020-01-01'), new Date('2020-01-02'));
    expect(result).toBeNull();
  });

  test('getExportDir and setExportDir', () => {
    const logbook = makeLogbook();
    const exportDir = path.join(rootDir, `exports-${testCounter}`);
    const svc = createCsDailyExport({ logbook, exportDir });
    expect(svc.getExportDir()).toBe(exportDir);
    const newDir = path.join(rootDir, `new-exports-${testCounter}`);
    svc.setExportDir(newDir);
    expect(svc.getExportDir()).toBe(newDir);
  });

  test('getExportHistory returns records of exports', () => {
    const logbook = makeLogbook();
    const exportDir = path.join(rootDir, `exports-${testCounter}`);
    const now = Date.now();
    logbook.record({
      action: 'dispense',
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'L001',
      quantity: 1,
      unit: 'ml',
      veterinarianId: 'vet-1',
      veterinarianName: 'Dr. Smith',
    });

    const svc = createCsDailyExport({ logbook, exportDir, now: () => now });
    svc.exportDailyLog(new Date(now));
    const history = svc.getExportHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      rowCount: 1,
      filePath: expect.stringContaining('cs-daily-'),
    });
  });

  test('CSV properly escapes special characters in cells', () => {
    const logbook = makeLogbook();
    const exportDir = path.join(rootDir, `exports-${testCounter}`);
    logbook.record({
      action: 'dispense',
      drugName: 'Test, Drug "A"',
      drugClass: 'CIII',
      lotNumber: 'L001',
      quantity: 1,
      unit: 'ml',
      veterinarianId: 'vet-1',
      veterinarianName: 'Dr. "Smith"',
    });

    const svc = createCsDailyExport({ logbook, exportDir });
    const result = svc.exportDailyLog(new Date());
    const content = fs.readFileSync(result!.filePath, 'utf8');
    expect(content).toContain('"Test, Drug ""A"""');
    expect(content).toContain('"Dr. ""Smith"""');
  });
});
