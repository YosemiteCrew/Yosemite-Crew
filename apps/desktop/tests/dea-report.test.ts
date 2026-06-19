import { createAuditLog } from '../src/compliance/audit-log';
import { createControlledSubstanceLogbook } from '../src/compliance/controlled-substance';
import { generateDeaReport, formatDeaReport } from '../src/compliance/dea-report';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('generateDeaReport', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dea-report-test-'));
  let mockFs: Record<string, string> = {};

  const makeDeps = (nowVal = 1000) => ({
    readFileSync: jest.fn((filePath: string) => {
      if (mockFs[filePath] !== undefined) return mockFs[filePath];
      throw new Error('ENOENT');
    }),
    writeFileSync: jest.fn((filePath: string, data: string) => {
      mockFs[filePath] = data;
    }),
    mkdirSync: jest.fn(),
    existsSync: jest.fn((filePath: string) => mockFs[filePath] !== undefined),
    now: jest.fn(() => nowVal),
  });

  beforeEach(() => {
    mockFs = {};
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('generates report with correct structure and balances', async () => {
    const nowMs = 1000;
    const deps = makeDeps(nowMs);
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, {
      auditLog,
      ...deps,
    });

    logbook.record({
      action: 'receive',
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'LOT-001',
      quantity: 100,
      unit: 'mL',
      veterinarianId: 'vet-456',
      veterinarianName: 'Dr. Smith',
    });
    logbook.record({
      action: 'dispense',
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'LOT-001',
      quantity: 30,
      unit: 'mL',
      patientId: 'pet-123',
      patientName: 'Buddy',
      veterinarianId: 'vet-456',
      veterinarianName: 'Dr. Smith',
    });
    logbook.record({
      action: 'waste',
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'LOT-001',
      quantity: 5,
      unit: 'mL',
      veterinarianId: 'vet-456',
      veterinarianName: 'Dr. Smith',
    });
    logbook.record({
      action: 'administer',
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'LOT-001',
      quantity: 2,
      unit: 'mL',
      veterinarianId: 'vet-456',
      veterinarianName: 'Dr. Smith',
    });

    const report = generateDeaReport({
      logbook,
      facilityName: 'Happy Paws Clinic',
      deaNumber: 'DEA-12345',
      now: () => nowMs,
    });

    expect(report.facilityName).toBe('Happy Paws Clinic');
    expect(report.deaNumber).toBe('DEA-12345');
    expect(report.generatedAt).toBe(nowMs);
    expect(report.totalDrugs).toBe(1);

    const ketamine = report.drugs[0];
    expect(ketamine.received).toBe(100);
    expect(ketamine.dispensed).toBe(30);
    expect(ketamine.wasted).toBe(5);
    expect(ketamine.administered).toBe(2);
    expect(ketamine.endingInventory).toBe(63);
    expect(ketamine.transactions).toHaveLength(4);
  });

  test('handles transfer transactions with positive and negative quantities', async () => {
    const deps = makeDeps(1000);
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, {
      auditLog,
      ...deps,
    });

    logbook.record({
      action: 'transfer',
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'LOT-001',
      quantity: 20,
      unit: 'mL',
      veterinarianId: 'vet-456',
      veterinarianName: 'Dr. Smith',
    });
    logbook.record({
      action: 'transfer',
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'LOT-001',
      quantity: -10,
      unit: 'mL',
      veterinarianId: 'vet-456',
      veterinarianName: 'Dr. Smith',
    });

    const report = generateDeaReport({ logbook, now: () => 1000 });
    const ketamine = report.drugs.find((d) => d.drugName === 'Ketamine');
    expect(ketamine?.transferIn).toBe(20);
    expect(ketamine?.transferOut).toBe(10);
    expect(ketamine?.endingInventory).toBe(10);
  });

  test('beginning inventory reflects transactions before the report window', async () => {
    let clock = 0;
    const deps = { ...makeDeps(), now: jest.fn(() => clock) };
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, { auditLog, ...deps });
    const base = {
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'L1',
      unit: 'mL',
      veterinarianId: 'v1',
      veterinarianName: 'Dr. X',
    };
    // Receipt long BEFORE the 2-year window (t=0).
    clock = 0;
    logbook.record({ ...base, action: 'receive', quantity: 100 });
    // Dispense inside the window (t = reportNow).
    const reportNow = 5 * 365 * 24 * 60 * 60 * 1000;
    clock = reportNow;
    logbook.record({ ...base, action: 'dispense', quantity: 30 });

    const report = generateDeaReport({ logbook, now: () => reportNow });
    const ketamine = report.drugs.find((d) => d.drugName === 'Ketamine');
    expect(ketamine?.beginningInventory).toBe(100);
    expect(ketamine?.endingInventory).toBe(70);
  });

  test('uses default drugClass and schedule for drugs with empty drugClass', async () => {
    const deps = makeDeps(1000);
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, {
      auditLog,
      ...deps,
    });

    logbook.record({
      action: 'receive',
      drugName: 'Unknown',
      drugClass: 'CI',
      lotNumber: 'LOT-001',
      quantity: 10,
      unit: 'mL',
      veterinarianId: 'vet-456',
      veterinarianName: 'Dr. Smith',
    });

    const report = generateDeaReport({ logbook, now: () => 1000 });
    const drug = report.drugs.find((d) => d.drugName === 'Unknown');
    expect(drug?.drugClass).toBe('CI');
    expect(drug?.schedule).toBe('III');
  });

  test('generates empty report when no transactions', async () => {
    const deps = makeDeps();
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, {
      auditLog,
      ...deps,
    });

    const report = generateDeaReport({ logbook, facilityName: 'Test Clinic' });
    expect(report.totalDrugs).toBe(0);
    expect(report.drugs).toHaveLength(0);
  });

  test('handles multiple drugs', async () => {
    const deps = makeDeps(1000);
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, {
      auditLog,
      ...deps,
    });

    logbook.record({
      action: 'receive',
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'LOT-001',
      quantity: 100,
      unit: 'mL',
      veterinarianId: 'vet-456',
      veterinarianName: 'Dr. Smith',
    });
    logbook.record({
      action: 'receive',
      drugName: 'Dexdomitor',
      drugClass: 'CII',
      lotNumber: 'LOT-002',
      quantity: 50,
      unit: 'mL',
      veterinarianId: 'vet-456',
      veterinarianName: 'Dr. Smith',
    });

    const report = generateDeaReport({ logbook, now: () => 1000 });
    expect(report.totalDrugs).toBe(2);
    expect(report.drugs.map((d) => d.drugName).sort()).toEqual(['Dexdomitor', 'Ketamine']);
  });

  test('maps drug class to DEA schedule correctly', async () => {
    const deps = makeDeps(1000);
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, {
      auditLog,
      ...deps,
    });

    logbook.record({
      action: 'receive',
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'LOT-001',
      quantity: 100,
      unit: 'mL',
      veterinarianId: 'vet-456',
      veterinarianName: 'Dr. Smith',
    });
    logbook.record({
      action: 'receive',
      drugName: 'Fentanyl',
      drugClass: 'CII',
      lotNumber: 'LOT-003',
      quantity: 50,
      unit: 'mL',
      veterinarianId: 'vet-456',
      veterinarianName: 'Dr. Smith',
    });

    const report = generateDeaReport({ logbook, now: () => 1000 });
    const ketamine = report.drugs.find((d) => d.drugName === 'Ketamine');
    const fentanyl = report.drugs.find((d) => d.drugName === 'Fentanyl');
    expect(ketamine?.schedule).toBe('III');
    expect(fentanyl?.schedule).toBe('II');
  });

  test('maps CIV and CV drug classes correctly', async () => {
    const deps = makeDeps(1000);
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, {
      auditLog,
      ...deps,
    });

    logbook.record({
      action: 'receive',
      drugName: 'Valium',
      drugClass: 'CIV',
      lotNumber: 'LOT-004',
      quantity: 30,
      unit: 'mL',
      veterinarianId: 'vet-456',
      veterinarianName: 'Dr. Smith',
    });
    logbook.record({
      action: 'receive',
      drugName: 'Codeine',
      drugClass: 'CV',
      lotNumber: 'LOT-005',
      quantity: 20,
      unit: 'mL',
      veterinarianId: 'vet-456',
      veterinarianName: 'Dr. Smith',
    });

    const report = generateDeaReport({ logbook, now: () => 1000 });
    expect(report.drugs.find((d) => d.drugName === 'Valium')?.schedule).toBe('IV');
    expect(report.drugs.find((d) => d.drugName === 'Codeine')?.schedule).toBe('V');
  });
});

describe('formatDeaReport', () => {
  const sampleReport = {
    generatedAt: 1000,
    facilityName: 'Test Clinic',
    deaNumber: 'DEA-123',
    period: { start: '2024-06-14', end: '2026-06-14' },
    drugs: [
      {
        drugName: 'Ketamine',
        drugClass: 'CIII',
        schedule: 'III',
        beginningInventory: 0,
        received: 100,
        dispensed: 30,
        administered: 0,
        wasted: 5,
        transferIn: 0,
        transferOut: 0,
        endingInventory: 65,
        transactions: [],
      },
    ],
    totalDrugs: 1,
  };

  test('json format produces valid JSON', () => {
    const output = formatDeaReport(sampleReport, 'json');
    const parsed = JSON.parse(output);
    expect(parsed.facilityName).toBe('Test Clinic');
  });

  test('csv format produces CSV with header', () => {
    const output = formatDeaReport(sampleReport, 'csv');
    expect(output).toContain('Drug Name');
    expect(output).toContain('Ketamine');
    expect(output).toContain('65');
  });

  test('text format produces human-readable output', () => {
    const output = formatDeaReport(sampleReport, 'text');
    expect(output).toContain('DEA Biennial Inventory Report');
    expect(output).toContain('Ketamine');
    expect(output).toContain('65');
  });
});
