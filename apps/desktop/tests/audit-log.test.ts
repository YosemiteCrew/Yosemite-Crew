import { createAuditLog, type AuditEntry } from '../src/compliance/audit-log';
import path from 'node:path';
import os from 'node:os';
import { createMemoryFs, asDeps, readJsonl, type MemoryFs } from './helpers/memory-fs';

describe('createAuditLog', () => {
  const tmpDir = path.join(os.tmpdir(), 'audit-log-test');
  const logPath = path.join(tmpDir, 'audit-log.jsonl');
  let mem: MemoryFs;

  const makeDeps = (nowVal?: number | (() => number)) =>
    asDeps(mem, typeof nowVal === 'function' ? nowVal : () => nowVal ?? 1000);

  /** Overwrites the append-only log with an attacker-supplied set of entries. */
  const rewriteLog = (entries: AuditEntry[]): void => {
    mem.files.set(logPath, entries.map((e) => `${JSON.stringify(e)}\n`).join(''));
  };

  beforeEach(() => {
    mem = createMemoryFs();
  });

  test('append creates an entry with id, timestamp, and signature', async () => {
    const deps = makeDeps(1000);
    const log = await createAuditLog(tmpDir, deps);

    const entry = log.append({
      action: 'patient:update',
      actor: 'dr-smith',
      resourceType: 'patient',
      resourceId: 'p1',
      details: { field: 'name', oldValue: 'Buddy', newValue: 'Max' },
    });

    expect(entry.id).toBeDefined();
    expect(entry.timestamp).toBe(1000);
    expect(entry.signature).toBeDefined();
    expect(entry.action).toBe('patient:update');
    expect(entry.actor).toBe('dr-smith');
    expect(log.size()).toBe(1);
  });

  test('query filters by resourceType', async () => {
    const deps = makeDeps(1000);
    const log = await createAuditLog(tmpDir, deps);

    log.append({
      action: 'patient:create',
      actor: 'dr-jones',
      resourceType: 'patient',
      resourceId: 'p1',
      details: {},
    });
    log.append({
      action: 'appointment:create',
      actor: 'dr-jones',
      resourceType: 'appointment',
      resourceId: 'a1',
      details: {},
    });

    const results = log.query({ resourceType: 'patient' });
    expect(results).toHaveLength(1);
    expect(results[0].action).toBe('patient:create');
  });

  test('query filters by resourceId', async () => {
    const deps = makeDeps(1000);
    const log = await createAuditLog(tmpDir, deps);

    log.append({
      action: 'patient:update',
      actor: 'dr-smith',
      resourceType: 'patient',
      resourceId: 'p1',
      details: {},
    });
    log.append({
      action: 'patient:update',
      actor: 'dr-jones',
      resourceType: 'patient',
      resourceId: 'p2',
      details: {},
    });

    const results = log.query({ resourceId: 'p1' });
    expect(results).toHaveLength(1);
    expect(results[0].actor).toBe('dr-smith');
  });

  test('query filters by since timestamp', async () => {
    let t = 1000;
    const deps = makeDeps(() => {
      const v = t;
      t += 1000;
      return v;
    });
    const log = await createAuditLog(tmpDir, deps);

    log.append({
      action: 'create',
      actor: 'dr-a',
      resourceType: 'patient',
      resourceId: 'p1',
      details: {},
    });
    log.append({
      action: 'create',
      actor: 'dr-b',
      resourceType: 'patient',
      resourceId: 'p2',
      details: {},
    });

    const results = log.query({ since: 1500 });
    expect(results).toHaveLength(1);
    expect(results[0].actor).toBe('dr-b');
  });

  test('query() without filters does not mutate the stored chain order', async () => {
    let t = 1000;
    const deps = makeDeps(() => (t += 100));
    const log = await createAuditLog(tmpDir, deps);
    log.append({
      action: 'create',
      actor: 'a',
      resourceType: 'patient',
      resourceId: 'p1',
      details: {},
    });
    log.append({
      action: 'create',
      actor: 'b',
      resourceType: 'patient',
      resourceId: 'p2',
      details: {},
    });
    // No-filter query previously sorted the cached array in place (newest-first),
    // so the next append linked its prevSignature to the wrong (reordered) entry.
    log.query();
    log.append({
      action: 'create',
      actor: 'c',
      resourceType: 'patient',
      resourceId: 'p3',
      details: {},
    });
    expect(log.verifyChain()).toBe(true);
  });

  test('query limits results and sorts descending by timestamp', async () => {
    let t = 1000;
    const deps = makeDeps(() => {
      const v = t;
      t += 1000;
      return v;
    });
    const log = await createAuditLog(tmpDir, deps);

    log.append({
      action: 'a1',
      actor: 'dr-a',
      resourceType: 'patient',
      resourceId: 'p1',
      details: {},
    });
    log.append({
      action: 'a2',
      actor: 'dr-b',
      resourceType: 'patient',
      resourceId: 'p2',
      details: {},
    });
    log.append({
      action: 'a3',
      actor: 'dr-c',
      resourceType: 'patient',
      resourceId: 'p3',
      details: {},
    });

    const results = log.query({ limit: 2 });
    expect(results).toHaveLength(2);
    expect(results[0].action).toBe('a3');
    expect(results[1].action).toBe('a2');
  });

  test('getByResource returns entries for a specific resource', async () => {
    const deps = makeDeps(1000);
    const log = await createAuditLog(tmpDir, deps);

    log.append({
      action: 'update',
      actor: 'dr-a',
      resourceType: 'patient',
      resourceId: 'p1',
      details: {},
    });
    log.append({
      action: 'update',
      actor: 'dr-b',
      resourceType: 'patient',
      resourceId: 'p1',
      details: {},
    });
    log.append({
      action: 'update',
      actor: 'dr-a',
      resourceType: 'patient',
      resourceId: 'p2',
      details: {},
    });

    expect(log.getByResource('patient', 'p1')).toHaveLength(2);
    expect(log.getByResource('patient', 'p2')).toHaveLength(1);
  });

  test('getByActor returns entries for a specific actor', async () => {
    const deps = makeDeps(1000);
    const log = await createAuditLog(tmpDir, deps);

    log.append({
      action: 'update',
      actor: 'dr-smith',
      resourceType: 'patient',
      resourceId: 'p1',
      details: {},
    });
    log.append({
      action: 'delete',
      actor: 'dr-smith',
      resourceType: 'patient',
      resourceId: 'p2',
      details: {},
    });
    log.append({
      action: 'update',
      actor: 'dr-jones',
      resourceType: 'patient',
      resourceId: 'p3',
      details: {},
    });

    expect(log.getByActor('dr-smith')).toHaveLength(2);
    expect(log.getByActor('dr-jones')).toHaveLength(1);
  });

  test('getRange returns entries within a time window', async () => {
    let t = 1000;
    const deps = makeDeps(() => {
      const v = t;
      t += 1000;
      return v;
    });
    const log = await createAuditLog(tmpDir, deps);

    log.append({
      action: 'old',
      actor: 'dr-a',
      resourceType: 'patient',
      resourceId: 'p1',
      details: {},
    });
    log.append({
      action: 'mid',
      actor: 'dr-a',
      resourceType: 'patient',
      resourceId: 'p2',
      details: {},
    });
    log.append({
      action: 'new',
      actor: 'dr-a',
      resourceType: 'patient',
      resourceId: 'p3',
      details: {},
    });

    expect(log.getRange(1500, 2500)).toHaveLength(1);
    expect(log.getRange(1500, 2500)[0].action).toBe('mid');
  });

  test('verify returns true for untampered entry', async () => {
    const deps = makeDeps(1000);
    const log = await createAuditLog(tmpDir, deps);

    const entry = log.append({
      action: 'patient:create',
      actor: 'dr-smith',
      resourceType: 'patient',
      resourceId: 'p1',
      details: { breed: 'Lab' },
    });

    expect(log.verify(entry)).toBe(true);
  });

  test('verify returns false for tampered entry', async () => {
    const deps = makeDeps(1000);
    const log = await createAuditLog(tmpDir, deps);

    log.append({
      action: 'patient:create',
      actor: 'dr-smith',
      resourceType: 'patient',
      resourceId: 'p1',
      details: {},
    });

    // read the persisted log, tamper with it, write it back
    const entries = readJsonl<AuditEntry>(mem, logPath);
    entries[0].details = { breed: 'Poodle' };
    rewriteLog(entries);
    const tamperedLog = await createAuditLog(tmpDir, deps);

    const tampered = tamperedLog.query({ resourceType: 'patient' });
    expect(tampered[0].details).toEqual({ breed: 'Poodle' });
    expect(tamperedLog.verify(tampered[0])).toBe(false);
  });

  test('verifyAll reports valid and tampered counts', async () => {
    const deps = makeDeps(1000);
    const log = await createAuditLog(tmpDir, deps);

    log.append({
      action: 'create',
      actor: 'dr-a',
      resourceType: 'patient',
      resourceId: 'p1',
      details: {},
    });
    log.append({
      action: 'create',
      actor: 'dr-b',
      resourceType: 'patient',
      resourceId: 'p2',
      details: {},
    });

    const entries = readJsonl<AuditEntry>(mem, logPath);
    entries[0].resourceId = 'p999';
    rewriteLog(entries);
    const tamperedLog = await createAuditLog(tmpDir, deps);

    const after = tamperedLog.verifyAll();
    expect(after).toEqual({ valid: 1, tampered: 1, otherKey: 0 });
  });

  test('size returns correct count', async () => {
    const deps = makeDeps(1000);
    const log = await createAuditLog(tmpDir, deps);

    expect(log.size()).toBe(0);
    log.append({
      action: 'a',
      actor: 'dr-a',
      resourceType: 'patient',
      resourceId: 'p1',
      details: {},
    });
    expect(log.size()).toBe(1);
    log.append({
      action: 'b',
      actor: 'dr-a',
      resourceType: 'patient',
      resourceId: 'p2',
      details: {},
    });
    expect(log.size()).toBe(2);
  });

  test('verifyChain detects reordering or deletion', async () => {
    let t = 1000;
    const deps = makeDeps(() => {
      const v = t;
      t += 1000;
      return v;
    });
    const log = await createAuditLog(tmpDir, deps);
    log.append({
      action: 'a',
      actor: 'x',
      resourceType: 'patient',
      resourceId: 'p1',
      details: {},
    });
    log.append({
      action: 'b',
      actor: 'x',
      resourceType: 'patient',
      resourceId: 'p2',
      details: {},
    });
    expect(log.verifyChain()).toBe(true);

    const entries = readJsonl<AuditEntry>(mem, logPath);
    rewriteLog([entries[1], entries[0]]); // reordered
    expect((await createAuditLog(tmpDir, deps)).verifyChain()).toBe(false);
  });

  test('persists the HMAC key encrypted when a secureStore is available', async () => {
    const fakeSecure = {
      isEncryptionAvailable: () => true,
      encryptString: (s: string) => Buffer.from(`enc:${s}`, 'utf8'),
      decryptString: (b: Buffer) => b.toString('utf8').replace(/^enc:/, ''),
    };
    const deps = { ...makeDeps(1000), secureStore: fakeSecure };
    const log = await createAuditLog(tmpDir, deps);
    const entry = log.append({
      action: 'a',
      actor: 'x',
      resourceType: 'patient',
      resourceId: 'p1',
      details: {},
    });

    const keyWrite = (deps.writeFileSync as jest.Mock).mock.calls.find((c) =>
      String(c[0]).endsWith('audit-key')
    );
    expect(keyWrite).toBeDefined();
    const wrapper = JSON.parse(keyWrite![1] as string) as {
      enc: boolean;
      data: string;
    };
    expect(wrapper.enc).toBe(true);
    expect(wrapper.data).not.toContain(entry.signature);

    // A fresh instance decrypts the stored key and verifies the entry.
    const log2 = await createAuditLog(tmpDir, deps);
    expect(log2.verify(entry)).toBe(true);
  });

  test('signatures are keyed: a different key fails verification', async () => {
    const entry = (await createAuditLog(tmpDir, { ...makeDeps(1000), hmacKey: 'key-one' })).append({
      action: 'a',
      actor: 'x',
      resourceType: 'patient',
      resourceId: 'p1',
      details: {},
    });
    const otherLog = await createAuditLog(tmpDir, {
      ...makeDeps(1000),
      hmacKey: 'key-two',
    });
    expect(otherLog.verify(entry)).toBe(false);
  });

  test('loads key from legacy plaintext format', async () => {
    const deps = makeDeps(1000);
    // manually write a key file in legacy { enc: false, key: '...' } format
    const keyPath = path.join(tmpDir, 'audit-key');
    const legacyKey = 'abcdef1234567890';
    mem.files.set(keyPath, JSON.stringify({ enc: false, key: legacyKey }));
    mem.files.set(path.join(tmpDir, 'audit-log.json'), '[]');
    mem.dirs.add(tmpDir);

    const log = await createAuditLog(tmpDir, deps);
    log.append({
      action: 'a',
      actor: 'x',
      resourceType: 'patient',
      resourceId: 'p1',
      details: {},
    });
    expect(log.size()).toBe(1);
  });

  test('loads key from legacy hex-only key file', async () => {
    const deps = makeDeps(1000);
    const keyPath = path.join(tmpDir, 'audit-key');
    mem.files.set(keyPath, '00'.repeat(32));
    mem.files.set(path.join(tmpDir, 'audit-log.json'), '[]');
    mem.dirs.add(tmpDir);

    const log = await createAuditLog(tmpDir, deps);
    log.append({
      action: 'create',
      actor: 'dr-a',
      resourceType: 'patient',
      resourceId: 'p1',
      details: {},
    });
    expect(log.size()).toBe(1);
  });

  test('verify detects signature length mismatch', async () => {
    const deps = makeDeps(1000);
    const log = await createAuditLog(tmpDir, deps);
    const entry = log.append({
      action: 'a',
      actor: 'x',
      resourceType: 'patient',
      resourceId: 'p1',
      details: {},
    });
    entry.signature = 'tooshort';
    expect(log.verify(entry)).toBe(false);
  });
});
