import {
  createControlledSubstanceLogbook,
  CsWriteError,
} from '../src/compliance/controlled-substance';
import { createAuditLog } from '../src/compliance/audit-log';
import { createMemoryFs, asDeps, type MemoryFs } from './helpers/memory-fs';

/**
 * Security tests for path traversal vulnerability mitigation in controlled substance logbook.
 *
 * These tests verify that the logbook rejects malicious path inputs that could lead to
 * path traversal attacks, where an attacker might try to read/write files outside the
 * intended directory.
 */
describe('Controlled Substance Logbook - Path Traversal Security', () => {
  let mem: MemoryFs;

  const makeFsDeps = (nowVal = 1000) => asDeps(mem, () => nowVal);

  beforeEach(() => {
    mem = createMemoryFs();
  });

  // One shape, many malicious inputs: the logbook must never touch the disk and
  // must never present a blocked directory as an empty-but-healthy register.
  test.each([
    ['.. in the directory path', '../../../etc'],
    ['multiple .. sequences', '../../../../../../root'],
    ['traversal hidden mid-path', 'data/../../../etc'],
    ['a traversal pointing at a seeded file', '../../../etc/passwd'],
  ])('blocks path traversal: %s', async (_label, maliciousPath) => {
    const deps = makeFsDeps(1000);
    const auditLog = await createAuditLog('safe-dir', deps);
    // Seed a file at the target so a successful traversal would be observable.
    mem.files.set(
      `${maliciousPath}/controlled-substance-log.jsonl`,
      `${JSON.stringify({ id: 'malicious-1', drugName: 'SensitiveData', timestamp: 1000 })}\n`
    );

    const logbook = createControlledSubstanceLogbook(maliciousPath, { auditLog, ...deps });

    expect(logbook.getTransactions()).toEqual([]);
    expect(logbook.size()).toBe(0);
    expect(logbook.getInventory()).toEqual([]);
    // A blocked register is not a healthy empty one.
    expect(logbook.getIntegrity().ok).toBe(false);
    expect(deps.readFileSync).not.toHaveBeenCalled();
  });

  test('a percent-encoded sequence is a literal directory name, not a traversal', async () => {
    const deps = makeFsDeps(1000);
    const auditLog = await createAuditLog('safe-dir', deps);
    // The filesystem never decodes %2F, so "..%2F..%2Fetc" names one directory
    // and cannot escape anywhere. The guard correctly leaves it alone; the
    // security property is that it stays put, not that it is rejected.
    const encodedPath = '..%2F..%2Fetc';
    mem.files.set(
      `${encodedPath}/controlled-substance-log.jsonl`,
      `${JSON.stringify({ id: 'local-1', drugName: 'Ketamine', timestamp: 1000 })}\n`
    );

    const logbook = createControlledSubstanceLogbook(encodedPath, { auditLog, ...deps });
    expect(logbook.getTransactions()).toHaveLength(1);
    // Reads stayed inside the named directory; nothing above it was touched.
    expect(deps.readFileSync.mock.calls.every(([f]) => String(f).startsWith(encodedPath))).toBe(
      true
    );
  });

  test('allows safe relative paths without traversal', async () => {
    const deps = makeFsDeps(1000);
    const auditLog = await createAuditLog('safe-directory', deps);

    // Safe relative path without any traversal
    const safePath = 'safe-directory';
    const logbook = createControlledSubstanceLogbook(safePath, {
      auditLog,
      ...deps,
    });

    // Normal operations should work with safe paths
    const tx = logbook.record({
      action: 'receive',
      drugName: 'Ketamine',
      drugClass: 'CIII',
      lotNumber: 'LOT-001',
      quantity: 100,
      unit: 'mL',
      veterinarianId: 'vet-456',
      veterinarianName: 'Dr. Smith',
    });

    expect(tx.id).toMatch(/^cs-/);
    expect(tx.drugName).toBe('Ketamine');
    expect(logbook.size()).toBe(1);

    // Verify the transaction can be retrieved
    const transactions = logbook.getTransactions();
    expect(transactions).toHaveLength(1);
    expect(transactions[0].drugName).toBe('Ketamine');
  });

  test('record on a blocked path throws instead of returning an unpersisted transaction', async () => {
    const deps = makeFsDeps(1000);
    const auditLog = await createAuditLog('safe-dir', deps);

    const maliciousPath = '../../sensitive';
    const logbook = createControlledSubstanceLogbook(maliciousPath, {
      auditLog,
      ...deps,
    });

    // Returning a transaction here is what let the UI confirm a dispense that
    // was never written. The caller must be told the record does not exist.
    expect(() =>
      logbook.record({
        action: 'receive',
        drugName: 'Ketamine',
        drugClass: 'CIII',
        lotNumber: 'LOT-001',
        quantity: 100,
        unit: 'mL',
        veterinarianId: 'vet-456',
        veterinarianName: 'Dr. Smith',
      })
    ).toThrow(CsWriteError);

    expect(logbook.getTransactions()).toEqual([]);
    expect(logbook.size()).toBe(0);
    // ...and the store says so, rather than reporting a healthy empty register.
    expect(logbook.getIntegrity().ok).toBe(false);
  });

  test('blocks absolute paths on Unix-like systems', async () => {
    const deps = makeFsDeps(1000);
    const auditLog = await createAuditLog('safe-dir', deps);

    // Absolute path attempt
    const maliciousPath = '/etc/passwd';
    const logbook = createControlledSubstanceLogbook(maliciousPath, {
      auditLog,
      ...deps,
    });

    // Should be blocked due to absolute path check
    expect(logbook.getTransactions()).toEqual([]);
    expect(logbook.size()).toBe(0);
    expect(deps.readFileSync).not.toHaveBeenCalled();
  });

  test('blocks absolute paths on Windows-like systems', async () => {
    const deps = makeFsDeps(1000);
    const auditLog = await createAuditLog('safe-dir', deps);

    // Windows absolute path attempt
    const maliciousPath = 'C:\\Windows\\System32';
    const logbook = createControlledSubstanceLogbook(maliciousPath, {
      auditLog,
      ...deps,
    });

    // Should be blocked due to absolute path check
    expect(logbook.getTransactions()).toEqual([]);
    expect(logbook.size()).toBe(0);
    expect(deps.readFileSync).not.toHaveBeenCalled();
  });
});
