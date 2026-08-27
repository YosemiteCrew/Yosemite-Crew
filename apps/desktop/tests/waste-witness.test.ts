import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createAuditLog } from '../src/compliance/audit-log';
import { createControlledSubstanceLogbook } from '../src/compliance/controlled-substance';
import { createDualWitnessLog } from '../src/compliance/dual-witness';

/**
 * Regression tests for blocker 3: yc:cs-record accepted action:'waste' with no
 * witness requirement at all, and the read path in dual-witness.ts hardcoded
 * `witnessPinVerified: true`. An unwitnessed destruction therefore read back as
 * witness-verified and was counted in the PMP dialog as a "Witnessed waste
 * event" - an affirmative false compliance statement on the normal path, with
 * no failure required. recordWaste and verifyWitnessPin existed but were never
 * called from any IPC channel or menu action.
 */

describe('waste events report the witness that was actually verified', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'waste-witness-test-'));
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

  const build = async () => {
    const deps = makeDeps();
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, { auditLog, ...deps });
    const dwLog = createDualWitnessLog({ logbook, auditLog, ...deps });
    return { logbook, dwLog, auditLog };
  };

  const WASTE = {
    action: 'waste' as const,
    drugName: 'Ketamine',
    drugClass: 'CIII',
    lotNumber: 'LOT-001',
    quantity: 3,
    unit: 'mL',
    veterinarianId: 'vet-1',
    veterinarianName: 'Dr. Smith',
  };

  beforeEach(() => {
    mockFs = {};
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('a waste transaction recorded without a witness does not read back as verified', async () => {
    const { logbook, dwLog } = await build();
    logbook.record(WASTE);

    const [event] = dwLog.getWasteEvents();
    expect(event.witnessId).toBe('');
    expect(event.witnessName).toBe('');
    // This was hardcoded true, which is the defect.
    expect(event.witnessPinVerified).toBe(false);
    expect(dwLog.getVerifiedWasteEvents()).toHaveLength(0);
  });

  test('a witness name alone is not verification', async () => {
    const { logbook, dwLog } = await build();
    logbook.record({ ...WASTE, witnessId: 'nurse-1', witnessName: 'Nurse Jane' });

    const [event] = dwLog.getWasteEvents();
    expect(event.witnessId).toBe('nurse-1');
    expect(event.witnessPinVerified).toBe(false);
    expect(dwLog.getVerifiedWasteEvents()).toHaveLength(0);
  });

  test('a verified waste event is reported as verified', async () => {
    const { logbook, dwLog } = await build();
    logbook.record({
      ...WASTE,
      witnessId: 'nurse-1',
      witnessName: 'Nurse Jane',
      witnessPinVerified: true,
    });

    const [event] = dwLog.getWasteEvents();
    expect(event.witnessPinVerified).toBe(true);
    expect(dwLog.getVerifiedWasteEvents()).toHaveLength(1);
  });

  test('getVerifiedWasteEvents separates verified from unverified for the same drug', async () => {
    const { logbook, dwLog } = await build();
    logbook.record({ ...WASTE, lotNumber: 'A' });
    logbook.record({
      ...WASTE,
      lotNumber: 'B',
      witnessId: 'nurse-1',
      witnessName: 'Nurse Jane',
      witnessPinVerified: true,
    });

    expect(dwLog.getWasteEvents('Ketamine')).toHaveLength(2);
    const verified = dwLog.getVerifiedWasteEvents('Ketamine');
    expect(verified).toHaveLength(1);
    expect(verified[0].lotNumber).toBe('B');
  });

  test('recordWaste persists the verification it performed', async () => {
    const { logbook, dwLog } = await build();
    dwLog.setWitnessPin('nurse-1', 'Nurse Jane', '1234');

    dwLog.recordWaste({
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'LOT-001',
      quantity: 3,
      unit: 'mL',
      veterinarianId: 'vet-1',
      veterinarianName: 'Dr. Smith',
      witnessId: 'nurse-1',
      witnessName: 'Nurse Jane',
      witnessPin: '1234',
      reason: 'partial dose',
    });

    // The flag reaches disk, so a later read is not guessing.
    expect(logbook.getTransactions()[0].witnessPinVerified).toBe(true);
    expect(dwLog.getVerifiedWasteEvents()).toHaveLength(1);
  });

  test('the verification flag is signed into the audit entry, so flipping it on disk is detectable', async () => {
    const deps = makeDeps();
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, { auditLog, ...deps });

    logbook.record({ ...WASTE, witnessId: 'nurse-1', witnessName: 'Nurse Jane' });

    const [entry] = auditLog.query({ resourceType: 'controlled-substance' });
    expect(entry.details.witnessPinVerified).toBe(false);
    expect(auditLog.verify(entry)).toBe(true);

    // The logbook file is not HMAC-protected. Someone with access to the data
    // directory can flip the flag there, but the signed audit entry still says
    // what was actually verified, so the two disagree and the alteration shows.
    const tampered = { ...entry, details: { ...entry.details, witnessPinVerified: true } };
    expect(auditLog.verify(tampered)).toBe(false);
  });

  test('a flag forged in the logbook file is not reported as verified', async () => {
    const { logbook, dwLog } = await build();
    // Recorded honestly as unverified...
    logbook.record({ ...WASTE, witnessId: 'nurse-1', witnessName: 'Nurse Jane' });
    expect(dwLog.getWasteEvents()[0].witnessPinVerified).toBe(false);

    // ...then the logbook file is edited on disk to claim verification. The
    // logbook is not HMAC-protected, so this succeeds; the audit entry is
    // untouched and still says false, so verifyAll/verifyChain still pass.
    const logFile = Object.keys(mockFs).find((f) => f.endsWith('controlled-substance-log.json'))!;
    const rows = JSON.parse(mockFs[logFile]) as Array<Record<string, unknown>>;
    rows[0].witnessPinVerified = true;
    mockFs[logFile] = JSON.stringify(rows);

    const { dwLog: reread } = await build();
    expect(reread.getWasteEvents()[0].witnessPinVerified).toBe(false);
    expect(reread.getVerifiedWasteEvents()).toHaveLength(0);
  });

  test('without the signed side, nothing can be reported as verified', async () => {
    const deps = makeDeps();
    const auditLog = await createAuditLog(tmpDir, deps);
    const logbook = createControlledSubstanceLogbook(tmpDir, { auditLog, ...deps });
    logbook.record({
      ...WASTE,
      witnessId: 'nurse-1',
      witnessName: 'Nurse Jane',
      witnessPinVerified: true,
    });

    // No auditLog supplied: verification cannot be proved, so it is not claimed.
    const blind = createDualWitnessLog({ logbook, ...deps });
    expect(blind.getWasteEvents()[0].witnessPinVerified).toBe(false);
  });

  test('getWasteByWitness also derives verification from the signed entry', async () => {
    const { logbook, dwLog } = await build();
    dwLog.setWitnessPin('nurse-1', 'Nurse Jane', '1234');
    dwLog.recordWaste({
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'LOT-001',
      quantity: 3,
      unit: 'mL',
      veterinarianId: 'vet-1',
      veterinarianName: 'Dr. Smith',
      witnessId: 'nurse-1',
      witnessName: 'Nurse Jane',
      witnessPin: '1234',
      reason: 'partial dose',
    });
    logbook.record({ ...WASTE, witnessId: 'nurse-1', witnessName: 'Nurse Jane' });

    const byWitness = dwLog.getWasteByWitness('nurse-1');
    expect(byWitness).toHaveLength(2);
    expect(byWitness.filter((e) => e.witnessPinVerified)).toHaveLength(1);
  });

  const auditFile = () => Object.keys(mockFs).find((f) => f.endsWith('audit-log.json'))!;
  const logFile = () => Object.keys(mockFs).find((f) => f.endsWith('controlled-substance-log.json'))!;

  const recordVerifiedWaste = (dwLog: ReturnType<typeof createDualWitnessLog>) => {
    dwLog.setWitnessPin('nurse-1', 'Nurse Jane', '1234');
    return dwLog.recordWaste({
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'LOT-A',
      quantity: 3,
      unit: 'mL',
      veterinarianId: 'vet-1',
      veterinarianName: 'Dr. Smith',
      witnessId: 'nurse-1',
      witnessName: 'Nurse Jane',
      witnessPin: '1234',
      reason: 'partial dose',
    });
  };

  test('an audit entry whose signature does not verify proves nothing', async () => {
    const { dwLog } = await build();
    recordVerifiedWaste(dwLog);
    expect(dwLog.getVerifiedWasteEvents()).toHaveLength(1);

    // Forge the signed side: the details still claim verification, but the
    // signature no longer matches, so the entry proves nothing.
    const entries = JSON.parse(mockFs[auditFile()]) as Array<Record<string, unknown>>;
    entries[0].signature = 'f'.repeat(64);
    mockFs[auditFile()] = JSON.stringify(entries);

    const { dwLog: reread } = await build();
    expect(reread.getWasteEvents()[0].witnessPinVerified).toBe(false);
    expect(reread.getVerifiedWasteEvents()).toHaveLength(0);
  });

  test('a transaction cannot borrow another record\'s verified audit entry', async () => {
    const { logbook, dwLog } = await build();
    const verified = recordVerifiedWaste(dwLog);
    logbook.record({ ...WASTE, lotNumber: 'LOT-B', witnessId: 'nurse-1', witnessName: 'Nurse Jane' });

    // Point the UNVERIFIED transaction at the verified transaction's audit
    // entry. The entry is genuine and its signature is valid, so only the
    // csTransactionId binding stops it being reused as proof.
    const rows = JSON.parse(mockFs[logFile()]) as Array<Record<string, unknown>>;
    const borrower = rows.find((r) => r.lotNumber === 'LOT-B')!;
    const donor = rows.find((r) => r.id === verified.csTransactionId)!;
    borrower.auditEntryId = donor.auditEntryId;
    borrower.witnessPinVerified = true;
    mockFs[logFile()] = JSON.stringify(rows);

    const { dwLog: reread } = await build();
    const events = reread.getWasteEvents();
    expect(events).toHaveLength(2);
    expect(events.filter((e) => e.witnessPinVerified)).toHaveLength(1);
    expect(reread.getWasteEvents('Ketamine').find((e) => e.lotNumber === 'LOT-B')!.witnessPinVerified).toBe(false);
  });

  test('hasWitness reports whether a witness can be verified at all', async () => {
    const { dwLog } = await build();
    expect(dwLog.hasWitness('nurse-1')).toBe(false);
    dwLog.setWitnessPin('nurse-1', 'Nurse Jane', '1234');
    expect(dwLog.hasWitness('nurse-1')).toBe(true);
  });
});
