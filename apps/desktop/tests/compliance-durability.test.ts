import path from 'node:path';
import os from 'node:os';
import { createAuditLog, AuditWriteError, type AuditEntry } from '../src/compliance/audit-log';
import {
  createControlledSubstanceLogbook,
  CsWriteError,
  type CsTransaction,
} from '../src/compliance/controlled-substance';
import { createMemoryFs, asDeps, readJsonl, type MemoryFs } from './helpers/memory-fs';

/**
 * Regression tests for the two release-blocking persistence defects found by the
 * DEA compliance audit:
 *
 *  - Blocker 1: both stores rewrote the entire JSON array on every append with a
 *    bare writeFileSync. A crash mid-write truncated the file, the next launch
 *    parsed it as empty, and the following append overwrote every survivor.
 *    verifyChain() then walked the one surviving entry and certified the wiped
 *    log as intact.
 *  - Blocker 2: save() swallowed every write error, so a dispense that never
 *    reached the disk was reported to the user as recorded, while the audit log
 *    kept a signed entry pointing at a transaction in no logbook.
 */

const CS_DIR = path.join(os.tmpdir(), 'cs-durability-test');
const CS_LOG = path.join(CS_DIR, 'controlled-substance-log.jsonl');
const AUDIT_LOG = path.join(CS_DIR, 'audit-log.jsonl');
const AUDIT_STATE = path.join(CS_DIR, 'audit-log.jsonl.state.json');

const DISPENSE = {
  action: 'dispense' as const,
  drugName: 'Ketamine',
  drugClass: 'CIII',
  lotNumber: 'LOT-001',
  quantity: 10,
  unit: 'mL',
  veterinarianId: 'vet-1',
  veterinarianName: 'Dr. Smith',
};

const AUDIT_INPUT = {
  action: 'patient:update',
  actor: 'dr-smith',
  resourceType: 'patient',
  resourceId: 'p1',
  details: {},
};

describe('compliance log durability (blocker 1: non-atomic writes)', () => {
  let mem: MemoryFs;
  let clock: number;
  const deps = () => asDeps(mem, () => (clock += 1000));

  beforeEach(() => {
    mem = createMemoryFs();
    clock = 1000;
  });

  test('records are appended, never rewritten, and are fsynced', async () => {
    const auditLog = await createAuditLog(CS_DIR, deps());
    const logbook = createControlledSubstanceLogbook(CS_DIR, { auditLog, ...deps() });

    logbook.record(DISPENSE);
    const afterFirst = mem.files.get(CS_LOG)!;
    logbook.record({ ...DISPENSE, lotNumber: 'LOT-002' });
    const afterSecond = mem.files.get(CS_LOG)!;

    // The whole-array rewrite is what allowed a partial write to destroy prior
    // records. The second append must leave the first record's bytes untouched.
    expect(afterSecond.startsWith(afterFirst)).toBe(true);
    expect(readJsonl<CsTransaction>(mem, CS_LOG)).toHaveLength(2);

    const appendFlags = mem.openSync.mock.calls
      .filter((c) => c[0] === CS_LOG)
      .map((c) => c[1] as string);
    expect(appendFlags.length).toBeGreaterThan(0);
    expect(appendFlags.every((f) => f.includes('a'))).toBe(true);
    expect(mem.fsyncCalls).toContain(CS_LOG);
  });

  test('an interrupted append cannot destroy the records already written', async () => {
    const auditLog = await createAuditLog(CS_DIR, deps());
    const logbook = createControlledSubstanceLogbook(CS_DIR, { auditLog, ...deps() });
    logbook.record(DISPENSE);
    logbook.record({ ...DISPENSE, lotNumber: 'LOT-002' });
    const survivors = readJsonl<CsTransaction>(mem, CS_LOG).map((tx) => tx.id);

    // Simulate a crash part-way through writing a third record.
    mem.truncateWrite((p) => p === CS_LOG, 20);
    expect(() => logbook.record({ ...DISPENSE, lotNumber: 'LOT-003' })).toThrow(CsWriteError);
    mem.clearFaults();

    // Reopen: the torn fragment is discarded, both complete records survive, and
    // the next append does not overwrite them.
    const reopened = createControlledSubstanceLogbook(CS_DIR, {
      auditLog: await createAuditLog(CS_DIR, deps()),
      ...deps(),
    });
    expect(reopened.getTransactions().map((tx) => tx.id).sort()).toEqual(survivors.sort());
    expect(reopened.getIntegrity().ok).toBe(false);
    expect(reopened.getIntegrity().tornTail).toBe(true);

    reopened.record({ ...DISPENSE, lotNumber: 'LOT-004' });
    const finalIds = readJsonl<CsTransaction>(mem, CS_LOG).map((tx) => tx.id);
    expect(finalIds).toEqual(expect.arrayContaining(survivors));
    expect(finalIds).toHaveLength(3);
  });

  test('a shortened audit log is reported as broken, not as an intact chain', async () => {
    const first = await createAuditLog(CS_DIR, deps());
    for (let i = 0; i < 5; i++) first.append({ ...AUDIT_INPUT, resourceId: `p${i}` });
    expect(first.verifyChain()).toBe(true);

    // Exactly the state a truncating crash used to leave behind: one genuine,
    // correctly signed genesis entry and nothing else.
    const entries = readJsonl<AuditEntry>(mem, AUDIT_LOG);
    mem.files.set(AUDIT_LOG, `${JSON.stringify(entries[0])}\n`);

    const reopened = await createAuditLog(CS_DIR, deps());
    expect(reopened.size()).toBe(1);
    // The surviving entry is individually valid, which is why walking the chain
    // alone declared the wiped log healthy.
    expect(reopened.verify(reopened.query()[0]!)).toBe(true);
    expect(reopened.verifyChain()).toBe(false);
    expect(reopened.getIntegrity().ok).toBe(false);
    expect(reopened.getIntegrity().reason).toContain('missing');
  });

  test('an unparseable audit log is quarantined instead of starting a new genesis chain', async () => {
    const first = await createAuditLog(CS_DIR, deps());
    first.append(AUDIT_INPUT);
    first.append({ ...AUDIT_INPUT, resourceId: 'p2' });

    // Damage a line in the middle of the file, not the tail.
    const lines = mem.files.get(AUDIT_LOG)!.split('\n');
    lines[0] = '{"id":"audit-1","action":"pat';
    mem.files.set(AUDIT_LOG, lines.join('\n'));

    const reopened = await createAuditLog(CS_DIR, deps());
    const integrity = reopened.getIntegrity();
    expect(integrity.ok).toBe(false);
    expect(integrity.quarantinePath).toBeTruthy();
    // The damaged bytes are preserved for an investigator, not deleted.
    expect(mem.files.get(integrity.quarantinePath!)).toContain('{"id":"audit-1","action":"pat');
    expect(reopened.verifyChain()).toBe(false);

    // The break is remembered across restarts: appending afterwards must not
    // make the replacement log look like a clean, intact history.
    reopened.append({ ...AUDIT_INPUT, resourceId: 'p3' });
    const later = await createAuditLog(CS_DIR, deps());
    expect(later.verifyChain()).toBe(false);
    expect(later.getIntegrity().reason).toContain('unparseable record inside the log');
    expect(
      (JSON.parse(mem.files.get(AUDIT_STATE)!) as { brokenAt?: number }).brokenAt
    ).toBeGreaterThan(0);
  });

  test('a legacy whole-array log is migrated into the append-only format', async () => {
    const legacyEntries = [
      { id: 'cs-legacy-1', drugName: 'Ketamine', action: 'receive', timestamp: 500, quantity: 5 },
      { id: 'cs-legacy-2', drugName: 'Ketamine', action: 'dispense', timestamp: 600, quantity: 2 },
    ];
    mem.dirs.add(CS_DIR);
    mem.files.set(path.join(CS_DIR, 'controlled-substance-log.json'), JSON.stringify(legacyEntries));

    const logbook = createControlledSubstanceLogbook(CS_DIR, {
      auditLog: await createAuditLog(CS_DIR, deps()),
      ...deps(),
    });

    expect(logbook.size()).toBe(2);
    expect(logbook.getIntegrity().ok).toBe(true);
    expect(readJsonl<CsTransaction>(mem, CS_LOG).map((tx) => tx.id)).toEqual([
      'cs-legacy-1',
      'cs-legacy-2',
    ]);
  });

  test('the watermark records how many entries should exist', async () => {
    const log = await createAuditLog(CS_DIR, deps());
    log.append(AUDIT_INPUT);
    log.append({ ...AUDIT_INPUT, resourceId: 'p2' });

    const state = JSON.parse(mem.files.get(AUDIT_STATE)!) as { count: number; last: string };
    expect(state.count).toBe(2);
    expect(state.last).toBe(readJsonl<AuditEntry>(mem, AUDIT_LOG)[1]!.signature);
  });
});

describe('compliance write failures (blocker 2: failures reported as success)', () => {
  let mem: MemoryFs;
  let clock: number;
  const deps = () => asDeps(mem, () => (clock += 1000));

  beforeEach(() => {
    mem = createMemoryFs();
    clock = 1000;
  });

  test('a dispense whose write fails throws instead of returning a transaction', async () => {
    const auditLog = await createAuditLog(CS_DIR, deps());
    const logbook = createControlledSubstanceLogbook(CS_DIR, { auditLog, ...deps() });

    // A full disk. No crash required.
    mem.failWrite((p) => p === CS_LOG, 'ENOSPC');

    expect(() => logbook.record(DISPENSE)).toThrow(CsWriteError);
    expect(readJsonl<CsTransaction>(mem, CS_LOG)).toHaveLength(0);
    expect(logbook.size()).toBe(0);
  });

  test('a locked file (antivirus, read-only dir) is reported, not swallowed', async () => {
    const auditLog = await createAuditLog(CS_DIR, deps());
    const logbook = createControlledSubstanceLogbook(CS_DIR, { auditLog, ...deps() });

    mem.failOpen((p) => p === CS_LOG, 'EPERM');
    expect(() => logbook.record(DISPENSE)).toThrow(CsWriteError);
  });

  test('a failed audit append does not leave a phantom entry in the session view', async () => {
    const log = await createAuditLog(CS_DIR, deps());
    log.append(AUDIT_INPUT);
    expect(log.size()).toBe(1);

    mem.failWrite((p) => p === AUDIT_LOG, 'ENOSPC');
    expect(() => log.append({ ...AUDIT_INPUT, resourceId: 'p2' })).toThrow(AuditWriteError);

    // The in-memory cache used to be assigned before the write was attempted, so
    // the session went on showing a signed entry that reached no disk.
    expect(log.size()).toBe(1);
    expect(log.query().map((e) => e.resourceId)).toEqual(['p1']);
    expect(readJsonl<AuditEntry>(mem, AUDIT_LOG)).toHaveLength(1);
  });

  test('a partially written record is rejected rather than silently accepted', async () => {
    const log = await createAuditLog(CS_DIR, deps());
    mem.truncateWrite((p) => p === AUDIT_LOG, 10);

    expect(() => log.append(AUDIT_INPUT)).toThrow(AuditWriteError);
    expect(log.size()).toBe(0);
  });
});
