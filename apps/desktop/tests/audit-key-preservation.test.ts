import crypto from 'node:crypto';
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

  test.each(['../../../etc', 'data/../../secrets'])(
    'refuses to read a signing key from a directory that escapes its parent: %s',
    async (badDir) => {
      // The key path was the last compliance path built with a bare join, so it
      // never went through the containment check the log paths use - and it is
      // the one that reads a secret. Seed a key at the traversed location so an
      // unguarded join would demonstrably read it.
      const escaped = `${badDir}/audit-key`;
      mem.dirs.add(badDir);
      mem.files.set(escaped, JSON.stringify({ enc: false, key: 'b'.repeat(64) }));

      await expect(createAuditLog(badDir, deps())).rejects.toThrow(/escapes its parent/);
      expect(mem.readFileSync.mock.calls.map(([f]) => f)).not.toContain(escaped);
      // ...and the file at the traversed path is untouched.
      expect(JSON.parse(mem.files.get(escaped)!).key).toBe('b'.repeat(64));
    }
  );

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

describe('a degraded window stays attributable after the keychain recovers', () => {
  /* The defect this closes (#2553), reproduced end to end over three sessions
     exactly as the issue describes: healthy keychain, then unreadable while a
     controlled-substance entry is written, then healthy again.

     Before entries carried a keyId, session 3 reported `{ valid: 1, tampered: 1 }`
     and `verifyChain() === false`, permanently and with no reason line, because
     `getIntegrity()` derived the degraded state from the LIVE key state and
     nothing remembered which rows it had applied to. On the DEA register that is
     a compliance alarm an operator can neither clear nor account for. */
  const DEGRADED_DIR = '/audit-degraded';

  test('the entry written on a temporary key is attributed, not called tampered', async () => {
    const mem = createMemoryFs();
    const deps = asDeps(mem, () => 1000);
    mem.dirs.add(DEGRADED_DIR);

    // Session 1: healthy keychain. E1 is signed with the stored key.
    const s1 = await createAuditLog(DEGRADED_DIR, { ...deps, secureStore: workingKeychain });
    s1.append(ENTRY);
    expect(s1.verifyAll()).toEqual({ valid: 1, tampered: 0, otherKey: 0 });

    // Session 2: keychain unavailable. The stored key is left alone and E2 is
    // written under a temporary one - the "keep recording" decision above.
    const s2 = await createAuditLog(DEGRADED_DIR, { ...deps, secureStore: null });
    expect(s2.getIntegrity().signingKey).toBe('session-only');
    s2.append({ ...ENTRY, action: 'cs:dispense', resourceId: 'cs-1' });

    // Session 3: keychain back. The stored key reads, so E1 verifies again -
    // and E2 must be reported as signed by another key rather than tampered.
    const s3 = await createAuditLog(DEGRADED_DIR, { ...deps, secureStore: workingKeychain });
    expect(s3.getIntegrity().signingKey).toBe('persisted');
    expect(s3.verifyAll()).toEqual({ valid: 1, tampered: 0, otherKey: 1 });

    /* The chain still cannot be attested, and that is the honest answer: without
       the temporary key, an edit made during that window is undetectable. What
       #2553 asked for is that the report EXPLAIN itself rather than say
       "Tampered", and it now does. */
    expect(s3.verifyChain()).toBe(false);
    const integrity = s3.getIntegrity();
    expect(integrity.ok).toBe(false);
    expect(integrity.reason).toContain('signed with a different key');
    expect(integrity.reason).toContain('not evidence of tampering');
  });

  test('a genuinely edited entry is still caught after a degraded window', async () => {
    /* The guard on the guard: attributing a foreign key must not become a way
       to smuggle an edit past verification. An entry altered in place still
       carries the CURRENT key's id, so it is checked and fails. */
    const mem = createMemoryFs();
    const deps = asDeps(mem, () => 1000);
    mem.dirs.add(DEGRADED_DIR);

    const s1 = await createAuditLog(DEGRADED_DIR, { ...deps, secureStore: workingKeychain });
    s1.append(ENTRY);

    const logPath = path.join(DEGRADED_DIR, 'audit-log.jsonl');
    const rows = mem.files
      .get(logPath)!
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    rows[0]!.actor = 'someone-else';
    mem.files.set(logPath, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

    const s2 = await createAuditLog(DEGRADED_DIR, { ...deps, secureStore: workingKeychain });
    expect(s2.verifyAll()).toEqual({ valid: 0, tampered: 1, otherKey: 0 });
    expect(s2.verifyChain()).toBe(false);
  });

  test('an entry written before keyId existed still verifies as valid', async () => {
    /* Backward compatibility, and the reason `signedByAnotherKey` requires a
       PRESENT-but-different stamp rather than treating absence as foreign.
       Pre-existing logs were signed with the stored key; if that key still
       reads, they verify. Calling them "signed with a different key" would move
       every entry of every existing install into `otherKey` and make
       getIntegrity report ok:false forever - a worse false alarm than the one
       this change removes. */
    const mem = createMemoryFs();
    const deps = asDeps(mem, () => 1000);
    mem.dirs.add(DEGRADED_DIR);
    const hmacKey = 'k'.repeat(64);

    const s1 = await createAuditLog(DEGRADED_DIR, { ...deps, hmacKey });
    s1.append(ENTRY);

    // Strip the stamp and re-sign exactly as the pre-keyId code would have:
    // the same payload, minus the trailing |keyId segment.
    const logPath = path.join(DEGRADED_DIR, 'audit-log.jsonl');
    const stored = JSON.parse(mem.files.get(logPath)!.trim()) as Record<string, unknown>;
    delete stored.keyId;
    const payload =
      `${stored.id}|${stored.timestamp}|${stored.action}|${stored.actor}|` +
      `${stored.resourceType}|${stored.resourceId}|${JSON.stringify(stored.details)}|` +
      `${stored.prevSignature}`;
    stored.signature = crypto.createHmac('sha256', hmacKey).update(payload).digest('hex');
    mem.files.set(logPath, JSON.stringify(stored) + '\n');

    const s2 = await createAuditLog(DEGRADED_DIR, { ...deps, hmacKey });
    expect(s2.query().at(0)!.keyId).toBeUndefined();
    // Valid, not otherKey - a stamp-less entry is not evidence of a key change.
    expect(s2.verifyAll()).toEqual({ valid: 1, tampered: 0, otherKey: 0 });
    /* Only the provenance claims are asserted here. Rewriting the file by hand
       is the only way to synthesise a pre-keyId entry, and that legitimately
       trips the store's watermark ("the log has been replaced") - which is its
       tamper detection working, and nothing to do with keyId. */
    expect(s2.verify(s2.query().at(0)!)).toBe(true);
  });

  test('relabelling only the keyId is itself detected', async () => {
    /* keyId is inside the signed payload, so moving an entry out of the `valid`
       count by relabelling it - without touching its contents - invalidates the
       signature. Otherwise anyone with file access could quietly reclassify a
       genuine entry as "signed by another key" and make the report meaningless
       in the other direction. */
    const mem = createMemoryFs();
    const deps = asDeps(mem, () => 1000);
    mem.dirs.add(DEGRADED_DIR);

    const s1 = await createAuditLog(DEGRADED_DIR, { ...deps, secureStore: workingKeychain });
    s1.append(ENTRY);

    const logPath = path.join(DEGRADED_DIR, 'audit-log.jsonl');
    const rows = mem.files
      .get(logPath)!
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const original = rows[0]!.keyId as string;
    expect(original).toBeDefined();
    // Contents untouched; only the provenance stamp is rewritten.
    rows[0]!.keyId = original === 'a'.repeat(16) ? 'b'.repeat(16) : 'a'.repeat(16);
    mem.files.set(logPath, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

    const s2 = await createAuditLog(DEGRADED_DIR, { ...deps, secureStore: workingKeychain });
    /* The entry AS STORED now carries a stamp the signature does not cover, so
       recomputing it fails. That is what proves keyId is inside the payload
       rather than sitting beside it. */
    const stored = s2.query().at(0)!;
    expect(stored.keyId).not.toBe(original);
    expect(s2.verify(stored)).toBe(false);
    expect(s2.verifyChain()).toBe(false);
  });

  test('rewriting keyId to disguise an edit does not work', async () => {
    /* keyId is inside the signed payload for any entry that has one, so an
       attacker cannot relabel a tampered row as "signed by another key" to move
       it out of the tampered count. */
    const mem = createMemoryFs();
    const deps = asDeps(mem, () => 1000);
    mem.dirs.add(DEGRADED_DIR);

    const s1 = await createAuditLog(DEGRADED_DIR, { ...deps, secureStore: workingKeychain });
    s1.append(ENTRY);

    const logPath = path.join(DEGRADED_DIR, 'audit-log.jsonl');
    const rows = mem.files
      .get(logPath)!
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    rows[0]!.actor = 'someone-else';
    rows[0]!.keyId = 'deadbeefdeadbeef';
    mem.files.set(logPath, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

    const s2 = await createAuditLog(DEGRADED_DIR, { ...deps, secureStore: workingKeychain });
    /* A relabel moves the row out of the `tampered` COUNT - unavoidable, since
       nothing here holds the key it now claims - but it must not buy a clean
       chain. An earlier draft skipped verification for foreign-key entries and
       this test walked green, which is the hole it exists to catch. */
    expect(s2.verifyAll().otherKey).toBe(1);
    expect(s2.verifyChain()).toBe(false);
    expect(s2.getIntegrity().ok).toBe(false);
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
    /* Uncheckable, which is what this test is named for. They were signed by
       the stored key and this session holds a temporary one, so they are
       attributed rather than accused - `tampered: 0`. Before entries carried a
       keyId this had to accept `tampered: 2`, so the assertion contradicted the
       test's own name (#2553). */
    expect(degraded.verifyAll()).toEqual({ valid: 0, tampered: 0, otherKey: 2 });
    // ...which is exactly why the integrity report must say the key is the
    // problem rather than letting the dialog print "Tampered: 2".
    expect(degraded.getIntegrity().signingKey).toBe('session-only');
    const entries: AuditEntry[] = degraded.query();
    expect(entries).toHaveLength(2);
  });
});
