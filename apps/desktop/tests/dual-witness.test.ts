import { createAuditLog } from '../src/compliance/audit-log';
import { createControlledSubstanceLogbook } from '../src/compliance/controlled-substance';
import { createDualWitnessLog } from '../src/compliance/dual-witness';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('createDualWitnessLog', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dual-witness-test-'));
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

  test('setWitnessPin and verifyWitnessPin work', async () => {
    const deps = makeDeps();
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, {
      auditLog,
      ...deps,
    });
    const dwLog = createDualWitnessLog({ logbook, ...deps });

    dwLog.setWitnessPin('witness-1', 'Nurse Jane', '1234');
    expect(dwLog.verifyWitnessPin('witness-1', '1234')).toBe(true);
    expect(dwLog.verifyWitnessPin('witness-1', 'wrong')).toBe(false);
    expect(dwLog.verifyWitnessPin('unknown', '1234')).toBe(false);
  });

  test('recordWaste creates waste event with pin verification', async () => {
    const deps = makeDeps();
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, {
      auditLog,
      ...deps,
    });
    const dwLog = createDualWitnessLog({
      logbook,
      now: deps.now,
      generateId: () => 'waste-1',
    });

    dwLog.setWitnessPin('witness-1', 'Nurse Jane', '1234');

    const event = dwLog.recordWaste({
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'LOT-001',
      quantity: 5,
      unit: 'mL',
      veterinarianId: 'vet-1',
      veterinarianName: 'Dr. Smith',
      witnessId: 'witness-1',
      witnessName: 'Nurse Jane',
      witnessPin: '1234',
      reason: 'Expired medication',
    });

    expect(event.witnessPinVerified).toBe(true);
    expect(event.reason).toBe('Expired medication');
    expect(event.csTransactionId).toBeDefined();
  });

  test('recordWaste logs pin verification failure', async () => {
    const deps = makeDeps();
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, {
      auditLog,
      ...deps,
    });
    const dwLog = createDualWitnessLog({ logbook, now: deps.now });

    dwLog.setWitnessPin('witness-1', 'Nurse Jane', '1234');

    const event = dwLog.recordWaste({
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'LOT-001',
      quantity: 5,
      unit: 'mL',
      veterinarianId: 'vet-1',
      veterinarianName: 'Dr. Smith',
      witnessId: 'witness-1',
      witnessName: 'Nurse Jane',
      witnessPin: 'wrong',
      reason: 'Test',
    });

    expect(event.witnessPinVerified).toBe(false);
    // An unverified witness must NOT produce an inventory transaction, or it would
    // decrement stock and read back via getWasteEvents() as a compliant record.
    expect(event.csTransactionId).toBe('');
    expect(logbook.getTransactions().filter((t) => t.action === 'waste')).toHaveLength(0);
    expect(dwLog.getWasteEvents()).toHaveLength(0);
  });

  test('getWasteEvents returns waste transactions', async () => {
    const deps = makeDeps(1000);
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, {
      auditLog,
      ...deps,
    });
    const dwLog = createDualWitnessLog({
      logbook,
      now: deps.now,
      generateId: () => 'waste-1',
    });

    dwLog.setWitnessPin('witness-1', 'Nurse Jane', '1234');
    dwLog.recordWaste({
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'LOT-001',
      quantity: 5,
      unit: 'mL',
      veterinarianId: 'vet-1',
      veterinarianName: 'Dr. Smith',
      witnessId: 'witness-1',
      witnessName: 'Nurse Jane',
      witnessPin: '1234',
      reason: 'Expired',
    });

    const events = dwLog.getWasteEvents('Ketamine');
    expect(events).toHaveLength(1);
    expect(events[0].drugName).toBe('Ketamine');
    // csTransactionId must reference the CS transaction id, not the audit-entry id.
    expect(events[0].csTransactionId).toBe(events[0].id);
    expect(events[0].csTransactionId).toMatch(/^cs-/);
  });

  test('getWasteEvents without drugName returns all waste events', async () => {
    const deps = makeDeps(1000);
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, {
      auditLog,
      ...deps,
    });
    const dwLog = createDualWitnessLog({
      logbook,
      now: deps.now,
      generateId: () => 'waste-1',
    });

    dwLog.setWitnessPin('witness-1', 'Nurse Jane', '1234');
    dwLog.recordWaste({
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'LOT-001',
      quantity: 5,
      unit: 'mL',
      veterinarianId: 'vet-1',
      veterinarianName: 'Dr. Smith',
      witnessId: 'witness-1',
      witnessName: 'Nurse Jane',
      witnessPin: '1234',
      reason: 'Expired',
    });
    dwLog.recordWaste({
      drugName: 'Diazepam',
      drugClass: 'CIV',
      lotNumber: 'LOT-002',
      quantity: 2,
      unit: 'mL',
      veterinarianId: 'vet-2',
      veterinarianName: 'Dr. Jones',
      witnessId: 'witness-1',
      witnessName: 'Nurse Jane',
      witnessPin: '1234',
      reason: 'Contaminated',
    });

    const events = dwLog.getWasteEvents();
    expect(events).toHaveLength(2);
  });

  test('getWasteByWitness returns events for specific witness', async () => {
    const deps = makeDeps(1000);
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, {
      auditLog,
      ...deps,
    });
    const dwLog = createDualWitnessLog({
      logbook,
      now: deps.now,
      generateId: () => 'waste-1',
    });

    dwLog.setWitnessPin('witness-1', 'Nurse Jane', '1234');
    dwLog.setWitnessPin('witness-2', 'Nurse Bob', '5678');
    dwLog.recordWaste({
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'LOT-001',
      quantity: 5,
      unit: 'mL',
      veterinarianId: 'vet-1',
      veterinarianName: 'Dr. Smith',
      witnessId: 'witness-1',
      witnessName: 'Nurse Jane',
      witnessPin: '1234',
      reason: 'Expired',
    });
    dwLog.recordWaste({
      drugName: 'Diazepam',
      drugClass: 'CIV',
      lotNumber: 'LOT-002',
      quantity: 2,
      unit: 'mL',
      veterinarianId: 'vet-2',
      veterinarianName: 'Dr. Jones',
      witnessId: 'witness-2',
      witnessName: 'Nurse Bob',
      witnessPin: '5678',
      reason: 'Contaminated',
    });

    const witness1Events = dwLog.getWasteByWitness('witness-1');
    expect(witness1Events).toHaveLength(1);
    expect(witness1Events[0].drugName).toBe('Ketamine');

    const witness2Events = dwLog.getWasteByWitness('witness-2');
    expect(witness2Events).toHaveLength(1);
    expect(witness2Events[0].drugName).toBe('Diazepam');
  });

  test('getWasteByWitness returns empty for unknown witness', async () => {
    const deps = makeDeps(1000);
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, {
      auditLog,
      ...deps,
    });
    const dwLog = createDualWitnessLog({
      logbook,
      now: deps.now,
      generateId: () => 'waste-1',
    });

    const events = dwLog.getWasteByWitness('unknown');
    expect(events).toHaveLength(0);
  });

  test('uses default generateId when not provided', async () => {
    const deps = makeDeps(1000);
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, {
      auditLog,
      ...deps,
    });
    const dwLog = createDualWitnessLog({ logbook, now: deps.now });

    dwLog.setWitnessPin('witness-1', 'Nurse Jane', '1234');
    const event = dwLog.recordWaste({
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'LOT-001',
      quantity: 5,
      unit: 'mL',
      veterinarianId: 'vet-1',
      veterinarianName: 'Dr. Smith',
      witnessId: 'witness-1',
      witnessName: 'Nurse Jane',
      witnessPin: '1234',
      reason: 'Test default id',
    });

    expect(event.id).toMatch(/^waste-/);
  });

  test('getWasteEvents falls back to empty strings for missing witness fields', async () => {
    const deps = makeDeps(1000);
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, {
      auditLog,
      ...deps,
    });
    const dwLog = createDualWitnessLog({
      logbook,
      now: deps.now,
      generateId: () => 'waste-fb',
    });

    logbook.record({
      action: 'waste',
      drugName: 'Morphine',
      drugClass: 'CII',
      lotNumber: 'LOT-003',
      quantity: 1,
      unit: 'mL',
      veterinarianId: 'vet-1',
      veterinarianName: 'Dr. Smith',
    });

    expect(logbook.size()).toBe(1);

    const events = dwLog.getWasteEvents();
    expect(events).toHaveLength(1);
    expect(events[0].witnessId).toBe('');
    expect(events[0].witnessName).toBe('');
    expect(events[0].reason).toBe('');
  });

  test('getWasteByWitness falls back to empty strings for missing witness fields', async () => {
    const deps = makeDeps(1000);
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, {
      auditLog,
      ...deps,
    });
    const dwLog = createDualWitnessLog({
      logbook,
      now: deps.now,
      generateId: () => 'waste-fb',
    });

    // Record with explicit empty strings to exercise || '' fallback in mapping
    logbook.record({
      action: 'waste',
      drugName: 'Morphine',
      drugClass: 'CII',
      lotNumber: 'LOT-003',
      quantity: 1,
      unit: 'mL',
      veterinarianId: 'vet-1',
      veterinarianName: 'Dr. Smith',
      witnessId: '',
      witnessName: '',
      notes: '',
    });

    const byWitness = dwLog.getWasteByWitness('');
    expect(byWitness).toHaveLength(1);
    expect(byWitness[0].witnessId).toBe('');
    expect(byWitness[0].witnessName).toBe('');
    expect(byWitness[0].reason).toBe('');
  });
});
