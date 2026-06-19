import { createControlledSubstanceLogbook } from '../src/compliance/controlled-substance';
import { createAuditLog } from '../src/compliance/audit-log';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('createControlledSubstanceLogbook', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-logbook-test-'));
  let mockFs: Record<string, string> = {};

  const makeFsDeps = (nowVal = 1000) => ({
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

  test('record adds a controlled substance transaction and audit entry', async () => {
    const deps = makeFsDeps();
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, {
      auditLog,
      ...deps,
    });

    const tx = logbook.record({
      action: 'dispense',
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'LOT-001',
      quantity: 10,
      unit: 'mL',
      patientId: 'pet-123',
      patientName: 'Buddy',
      veterinarianId: 'vet-456',
      veterinarianName: 'Dr. Smith',
    });

    expect(tx.id).toMatch(/^cs-/);
    expect(tx.timestamp).toBe(1000);
    expect(tx.action).toBe('dispense');
    expect(tx.auditEntryId).toBeDefined();
    expect(auditLog.size()).toBe(1);
    expect(logbook.size()).toBe(1);

    const auditEntry = auditLog.query({ resourceType: 'controlled-substance' });
    expect(auditEntry).toHaveLength(1);
    expect(auditEntry[0].action).toBe('cs:dispense');
  });

  test('signs the cs transaction id into the audit entry without tampering it', async () => {
    const deps = makeFsDeps();
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, {
      auditLog,
      ...deps,
    });

    const tx = logbook.record({
      action: 'dispense',
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'LOT-001',
      quantity: 10,
      unit: 'mL',
      patientId: 'pet-123',
      patientName: 'Buddy',
      veterinarianId: 'vet-456',
      veterinarianName: 'Dr. Smith',
    });

    const [auditEntry] = auditLog.query({
      resourceType: 'controlled-substance',
    });
    expect(auditEntry.details.csTransactionId).toBe(tx.id);
    expect(auditLog.verify(auditEntry)).toBe(true);
    expect(auditLog.verifyAll()).toEqual({ valid: 1, tampered: 0 });
  });

  test('getTransactions returns all transactions', async () => {
    const deps = makeFsDeps(1000);
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
      quantity: 10,
      unit: 'mL',
      patientId: 'pet-123',
      patientName: 'Buddy',
      veterinarianId: 'vet-456',
      veterinarianName: 'Dr. Smith',
    });

    const txs = logbook.getTransactions();
    expect(txs).toHaveLength(2);
  });

  test('getByDrug filters by drug name', async () => {
    const deps = makeFsDeps(1000);
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

    expect(logbook.getByDrug('Ketamine')).toHaveLength(1);
    expect(logbook.getByDrug('Dexdomitor')).toHaveLength(1);
  });

  test('getByVeterinarian filters by veterinarian', async () => {
    const deps = makeFsDeps(1000);
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
      quantity: 10,
      unit: 'mL',
      patientId: 'pet-123',
      patientName: 'Buddy',
      veterinarianId: 'vet-789',
      veterinarianName: 'Dr. Jones',
    });

    expect(logbook.getByVeterinarian('vet-456')).toHaveLength(1);
    expect(logbook.getByVeterinarian('vet-789')).toHaveLength(1);
  });

  test('getInventory calculates balances correctly', async () => {
    const deps = makeFsDeps(1000);
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

    const inventory = logbook.getInventory('Ketamine');
    expect(inventory).toHaveLength(1);
    expect(inventory[0].totalReceived).toBe(100);
    expect(inventory[0].totalDispensed).toBe(30);
    expect(inventory[0].totalWasted).toBe(5);
    expect(inventory[0].currentBalance).toBe(65);
  });

  test('getDailyLog returns transactions for a given date', async () => {
    const deps = makeFsDeps(1000);
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

    const date = new Date(1000);
    const daily = logbook.getDailyLog(date);
    expect(daily).toHaveLength(1);
  });

  test('getAuditTrail returns raw audit entries for controlled substances', async () => {
    const deps = makeFsDeps(1000);
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

    const trail = logbook.getAuditTrail();
    expect(trail).toHaveLength(1);
    expect(trail[0].action).toBe('cs:receive');
    expect(trail[0].resourceType).toBe('controlled-substance');
  });

  test('size returns correct count', async () => {
    const deps = makeFsDeps(1000);
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, {
      auditLog,
      ...deps,
    });

    expect(logbook.size()).toBe(0);
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
    expect(logbook.size()).toBe(1);
  });
});
