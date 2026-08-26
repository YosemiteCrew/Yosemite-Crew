import path from 'node:path';
import os from 'node:os';
import { Buffer } from 'node:buffer';
import { createAuditLog, type AuditEntry } from '../src/compliance/audit-log';
import { createMemoryFs, asDeps, type MemoryFs } from './helpers/memory-fs';

/**
 * Regression tests for blocker 4: when safeStorage was unavailable at startup
 * (no keyring session on Linux, a locked or reset login keychain) or
 * decryptString threw, the audit log minted a fresh HMAC key and wrote it over
 * the existing one. The original was then gone even after the keyring recovered,
 * every historical entry failed verify(), and Help > Verify Audit Trail reported
 * the whole history as "Tampered" - indistinguishable from real tampering.
 */

const DIR = path.join(os.tmpdir(), 'audit-key-test');
const KEY_PATH = path.join(DIR, 'audit-key');

const ENTRY = {
  action: 'patient:update',
  actor: 'dr-smith',
  resourceType: 'patient',
  resourceId: 'p1',
  details: {},
};

const workingKeychain = {
  isEncryptionAvailable: () => true,
  encryptString: (s: string) => Buffer.from(`enc:${s}`, 'utf8'),
  decryptString: (b: Buffer) => b.toString('utf8').replace(/^enc:/, ''),
};

describe('audit signing key preservation', () => {
  let mem: MemoryFs;
  const deps = () => asDeps(mem, () => 1000);

  beforeEach(() => {
    mem = createMemoryFs();
  });

  test('an unreadable key is never overwritten and recovers when the keychain returns', async () => {
    const first = await createAuditLog(DIR, { ...deps(), secureStore: workingKeychain });
    const entry = first.append(ENTRY);
    const originalKeyFile = mem.files.get(KEY_PATH)!;
    expect(first.verify(entry)).toBe(true);

    // Next launch with no keyring session: safeStorage is unavailable.
    const degraded = await createAuditLog(DIR, { ...deps(), secureStore: null });
    expect(mem.files.get(KEY_PATH)).toBe(originalKeyFile);
    expect(degraded.getIntegrity().signingKey).toBe('session-only');
    expect(degraded.getIntegrity().ok).toBe(false);
    expect(degraded.getIntegrity().reason).toContain('OS keychain is unavailable');
    expect(degraded.verifyChain()).toBe(false);

    // Keyring recovers on a later launch: the original key still decrypts and
    // the historical entry verifies again.
    const recovered = await createAuditLog(DIR, { ...deps(), secureStore: workingKeychain });
    expect(recovered.getIntegrity().signingKey).toBe('persisted');
    expect(recovered.verify(entry)).toBe(true);
    expect(recovered.verifyChain()).toBe(true);
  });

  test('a key the keychain cannot decrypt is left in place, not replaced', async () => {
    await createAuditLog(DIR, { ...deps(), secureStore: workingKeychain });
    const originalKeyFile = mem.files.get(KEY_PATH)!;

    const brokenKeychain = {
      isEncryptionAvailable: () => true,
      encryptString: (s: string) => Buffer.from(`enc:${s}`, 'utf8'),
      decryptString: () => {
        throw new Error('keychain item not found');
      },
    };
    const log = await createAuditLog(DIR, { ...deps(), secureStore: brokenKeychain });

    expect(mem.files.get(KEY_PATH)).toBe(originalKeyFile);
    expect(log.getIntegrity().signingKey).toBe('session-only');
    expect(log.getIntegrity().reason).toContain('could not decrypt the key');
  });

  test('a key file that cannot be read at all is left in place', async () => {
    mem.dirs.add(DIR);
    mem.files.set(KEY_PATH, JSON.stringify({ enc: false, key: 'a'.repeat(64) }));
    mem.readFileSync.mockImplementation((p: string) => {
      if (p === KEY_PATH) throw new Error('EACCES: permission denied');
      throw new Error('ENOENT');
    });

    const log = await createAuditLog(DIR, deps());
    expect(JSON.parse(mem.files.get(KEY_PATH)!)).toMatchObject({ key: 'a'.repeat(64) });
    expect(log.getIntegrity().signingKey).toBe('session-only');
    expect(log.getIntegrity().reason).toContain('could not be read');
  });

  test('an empty or unrecognised key file is not silently replaced', async () => {
    mem.dirs.add(DIR);
    mem.files.set(KEY_PATH, '   ');
    const emptyKeyLog = await createAuditLog(DIR, deps());
    expect(mem.files.get(KEY_PATH)).toBe('   ');
    expect(emptyKeyLog.getIntegrity().reason).toContain('empty');

    mem.files.set(KEY_PATH, 'this is not a key');
    const garbageKeyLog = await createAuditLog(DIR, deps());
    expect(mem.files.get(KEY_PATH)).toBe('this is not a key');
    expect(garbageKeyLog.getIntegrity().reason).toContain('not in a recognised format');
  });

  test('an encrypted key file with no key data is not replaced', async () => {
    mem.dirs.add(DIR);
    mem.files.set(KEY_PATH, JSON.stringify({ enc: true }));
    const log = await createAuditLog(DIR, { ...deps(), secureStore: workingKeychain });
    expect(JSON.parse(mem.files.get(KEY_PATH)!)).toEqual({ enc: true });
    expect(log.getIntegrity().reason).toContain('no key data');
  });

  test('a plaintext wrapper with an empty key is not replaced', async () => {
    mem.dirs.add(DIR);
    mem.files.set(KEY_PATH, JSON.stringify({ enc: false, key: '' }));
    const log = await createAuditLog(DIR, deps());
    expect(JSON.parse(mem.files.get(KEY_PATH)!)).toEqual({ enc: false, key: '' });
    expect(log.getIntegrity().reason).toContain('no usable key');
  });

  test('a genuinely absent key is still created on first run', async () => {
    const log = await createAuditLog(DIR, deps());
    expect(mem.files.has(KEY_PATH)).toBe(true);
    expect(log.getIntegrity().signingKey).toBe('persisted');
    const entry = log.append(ENTRY);
    expect(log.verify(entry)).toBe(true);
    expect(log.verifyChain()).toBe(true);
  });

  test('a key that cannot be saved runs session-only rather than claiming to be stored', async () => {
    mem.writeFileSync.mockImplementation(() => {
      throw new Error('EROFS: read-only file system');
    });
    const log = await createAuditLog(DIR, deps());
    expect(log.getIntegrity().signingKey).toBe('session-only');
    expect(log.getIntegrity().reason).toContain('could not be saved');
  });

  test('a session-only key still allows recording, so the events are not lost', async () => {
    mem.dirs.add(DIR);
    mem.files.set(KEY_PATH, JSON.stringify({ enc: true, data: 'xx' }));
    const log = await createAuditLog(DIR, { ...deps(), secureStore: null });

    const entry = log.append(ENTRY);
    expect(log.size()).toBe(1);
    // Signed with the temporary key, so it verifies within this session.
    expect(log.verify(entry)).toBe(true);
  });

  test('the key problem is combined with, not hidden by, a log problem', async () => {
    mem.dirs.add(DIR);
    mem.files.set(KEY_PATH, JSON.stringify({ enc: true, data: 'xx' }));
    mem.files.set(path.join(DIR, 'audit-log.jsonl'), 'corrupt line\n{"id":"a","action":"x"}\n');

    const log = await createAuditLog(DIR, { ...deps(), secureStore: null });
    const reason = log.getIntegrity().reason!;
    expect(reason).toContain('unparseable');
    expect(reason).toContain('signing key could not be read');
  });

  test('an explicitly injected key is treated as persisted', async () => {
    const log = await createAuditLog(DIR, { ...deps(), hmacKey: 'k'.repeat(64) });
    expect(log.getIntegrity().signingKey).toBe('persisted');
  });
});

describe('audit trail dialog with an unreadable key', () => {
  test('historical entries are reported as uncheckable, not as tampered', async () => {
    const mem = createMemoryFs();
    const deps = asDeps(mem, () => 1000);

    const first = await createAuditLog(DIR, { ...deps, secureStore: workingKeychain });
    first.append(ENTRY);
    first.append({ ...ENTRY, resourceId: 'p2' });

    const degraded = await createAuditLog(DIR, { ...deps, secureStore: null });
    // Every entry fails its signature check under the temporary key...
    expect(degraded.verifyAll()).toEqual({ valid: 0, tampered: 2 });
    // ...which is exactly why the integrity report must say the key is the
    // problem rather than letting the dialog print "Tampered: 2".
    expect(degraded.getIntegrity().signingKey).toBe('session-only');
    const entries: AuditEntry[] = degraded.query();
    expect(entries).toHaveLength(2);
  });
});
