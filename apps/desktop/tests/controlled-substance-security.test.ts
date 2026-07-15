import { createControlledSubstanceLogbook } from '../src/compliance/controlled-substance';
import { createAuditLog } from '../src/compliance/audit-log';
import fs from 'node:fs';

/**
 * Security tests for path traversal vulnerability mitigation in controlled substance logbook.
 * 
 * These tests verify that the logbook rejects malicious path inputs that could lead to
 * path traversal attacks, where an attacker might try to read/write files outside the
 * intended directory.
 */
describe('Controlled Substance Logbook - Path Traversal Security', () => {
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

  test('blocks path traversal with .. in directory path', async () => {
    const deps = makeFsDeps(1000);
    const auditLog = await createAuditLog('safe-dir', deps);
    
    // Attacker tries to traverse to sensitive directory
    const maliciousPath = '../../../etc';
    const logbook = createControlledSubstanceLogbook(maliciousPath, {
      auditLog,
      ...deps,
    });

    // Security check prevents reading from traversed path
    expect(logbook.getTransactions()).toEqual([]);
    expect(logbook.size()).toBe(0);
    
    // Verify no file system access occurred with the malicious path
    expect(deps.readFileSync).not.toHaveBeenCalled();
  });

  test('blocks path traversal with multiple .. sequences', async () => {
    const deps = makeFsDeps(1000);
    const auditLog = await createAuditLog('safe-dir', deps);
    
    // Multiple traversal attempts
    const maliciousPath = '../../../../../../root';
    const logbook = createControlledSubstanceLogbook(maliciousPath, {
      auditLog,
      ...deps,
    });

    // Should reject and return empty results
    expect(logbook.getTransactions()).toEqual([]);
    expect(logbook.size()).toBe(0);
    expect(logbook.getInventory()).toEqual([]);
  });

  test('blocks path traversal in mixed paths', async () => {
    const deps = makeFsDeps(1000);
    const auditLog = await createAuditLog('safe-dir', deps);
    
    // Traversal hidden in seemingly safe path
    const maliciousPath = 'data/../../../etc';
    const logbook = createControlledSubstanceLogbook(maliciousPath, {
      auditLog,
      ...deps,
    });

    // Should be blocked due to .. in path
    expect(logbook.getTransactions()).toEqual([]);
    expect(logbook.size()).toBe(0);
  });

  test('blocks path traversal with encoded sequences', async () => {
    const deps = makeFsDeps(1000);
    const auditLog = await createAuditLog('safe-dir', deps);
    
    // Path with encoded .. (though Node.js path.join normalizes this)
    const maliciousPath = '..%2F..%2Fetc';
    const logbook = createControlledSubstanceLogbook(maliciousPath, {
      auditLog,
      ...deps,
    });

    // The path contains '..' so should be rejected
    expect(logbook.getTransactions()).toEqual([]);
    expect(logbook.size()).toBe(0);
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

  test('prevents reading sensitive files via path traversal', async () => {
    const deps = makeFsDeps(1000);
    const auditLog = await createAuditLog('safe-dir', deps);
    
    // Simulate attacker trying to read /etc/passwd
    mockFs['../../../etc/passwd/controlled-substance-log.json'] = JSON.stringify([
      {
        id: 'malicious-1',
        drugName: 'SensitiveData',
        timestamp: 1000,
      },
    ]);
    
    const maliciousPath = '../../../etc/passwd';
    const logbook = createControlledSubstanceLogbook(maliciousPath, {
      auditLog,
      ...deps,
    });

    // Should not be able to read the sensitive file
    expect(logbook.getTransactions()).toEqual([]);
    expect(logbook.size()).toBe(0);
    
    // Verify readFileSync was not called (security check prevented it)
    expect(deps.readFileSync).not.toHaveBeenCalled();
  });

  test('record operation fails silently with malicious path', async () => {
    const deps = makeFsDeps(1000);
    const auditLog = await createAuditLog('safe-dir', deps);
    
    const maliciousPath = '../../sensitive';
    const logbook = createControlledSubstanceLogbook(maliciousPath, {
      auditLog,
      ...deps,
    });

    // Attempt to record a transaction
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

    // Transaction is created but not persisted
    expect(tx.id).toMatch(/^cs-/);
    
    // But reading back should return empty due to security check
    expect(logbook.getTransactions()).toEqual([]);
    expect(logbook.size()).toBe(0);
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
