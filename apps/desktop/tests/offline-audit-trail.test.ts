import { createAuditLog } from '../src/compliance/audit-log';
import { createOfflineAuditTrail } from '../src/compliance/offline-audit-trail';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('createOfflineAuditTrail', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-audit-test-'));
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

  test('logMutation appends an offline audit entry', async () => {
    const deps = makeDeps();
    const auditLog = await createAuditLog(tmpDir, deps);
    const trail = createOfflineAuditTrail({ auditLog, now: deps.now });

    trail.logMutation({
      id: 'm1',
      type: 'create',
      entityType: 'patient',
      entityId: 'p1',
      action: 'create',
    });

    const entries = auditLog.query({});
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe('offline:create');
  });

  test('getOfflineMutations returns mutation records', async () => {
    const deps = makeDeps(1000);
    const auditLog = await createAuditLog(tmpDir, deps);
    const trail = createOfflineAuditTrail({ auditLog, now: deps.now });

    trail.logMutation({
      id: 'm1',
      type: 'update',
      entityType: 'patient',
      entityId: 'p1',
      action: 'update',
    });

    const mutations = trail.getOfflineMutations();
    expect(mutations).toHaveLength(1);
    expect(mutations[0].mutationId).toBe('m1');
    expect(mutations[0].entityType).toBe('patient');
    expect(mutations[0].action).toBe('update');
  });

  test('getUnsyncedCount counts unsynced mutations', async () => {
    const deps = makeDeps(1000);
    const auditLog = await createAuditLog(tmpDir, deps);
    const trail = createOfflineAuditTrail({ auditLog, now: deps.now });

    trail.logMutation({
      id: 'm1',
      type: 'create',
      entityType: 'patient',
      entityId: 'p1',
      action: 'create',
    });

    expect(trail.getUnsyncedCount()).toBe(1);
  });

  test('getSyncFailureCount returns count', async () => {
    const deps = makeDeps(1000);
    const auditLog = await createAuditLog(tmpDir, deps);
    const trail = createOfflineAuditTrail({ auditLog, now: deps.now });

    trail.logMutation({
      id: 'm1',
      type: 'create',
      entityType: 'patient',
      entityId: 'p1',
      action: 'create',
    });

    expect(trail.getSyncFailureCount()).toBe(0);
  });
});
