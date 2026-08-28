import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertSafeFilePath, createJsonlStore } from '../src/compliance/durable-log';
import { createMemoryFs, type MemoryFs } from './helpers/memory-fs';

interface Rec {
  id: string;
  value: number;
}

const isRec = (v: unknown): v is Rec =>
  typeof v === 'object' && v !== null && typeof (v as Rec).id === 'string';

const DIR = path.join(os.tmpdir(), 'durable-log-test');
const LOG = path.join(DIR, 'log.jsonl');
const STATE = path.join(DIR, 'log.jsonl.state.json');
const LEGACY = path.join(DIR, 'log.json');

describe('createJsonlStore', () => {
  let mem: MemoryFs;
  let clock: number;

  const makeStore = (overrides: Partial<Parameters<typeof createJsonlStore<Rec>>[0]> = {}) =>
    createJsonlStore<Rec>({
      dirPath: DIR,
      fileName: 'log.jsonl',
      legacyFileName: 'log.json',
      isRecord: isRec,
      watermarkOf: (r) => r.id,
      fsq: mem,
      now: () => (clock += 1000),
      ...overrides,
    });

  beforeEach(() => {
    mem = createMemoryFs();
    clock = 1000;
    mem.dirs.add(DIR);
  });

  test('round-trips records through a real filesystem', () => {
    const realDir = fs.mkdtempSync(path.join(os.tmpdir(), 'durable-log-real-'));
    try {
      // No fs injection: this exercises the real openSync/writeSync/fsyncSync path.
      const store = createJsonlStore<Rec>({
        dirPath: realDir,
        fileName: 'log.jsonl',
        isRecord: isRec,
        watermarkOf: (r) => r.id,
      });
      store.append({ id: 'a', value: 1 });
      store.append({ id: 'b', value: 2 });

      const raw = fs.readFileSync(path.join(realDir, 'log.jsonl'), 'utf8');
      expect(raw).toBe('{"id":"a","value":1}\n{"id":"b","value":2}\n');
      expect(store.health().ok).toBe(true);
      expect(store.watermarkValue()).toBe('b');
    } finally {
      fs.rmSync(realDir, { recursive: true, force: true });
    }
  });

  test.each(['../../../etc', 'data/../../secrets', '..'])(
    'refuses a log directory that escapes its parent: %s',
    (badDir) => {
      // The audit log used to pass its directory straight through with no
      // traversal guard at all, unlike the controlled-substance logbook.
      expect(() =>
        createJsonlStore<Rec>({
          dirPath: badDir,
          fileName: 'log.jsonl',
          isRecord: isRec,
          watermarkOf: (r) => r.id,
          fsq: mem,
        })
      ).toThrow(/escapes its parent/);
    }
  );

  test('refuses a filename that escapes the log directory', () => {
    expect(() =>
      createJsonlStore<Rec>({
        dirPath: DIR,
        fileName: '../../etc/passwd',
        isRecord: isRec,
        watermarkOf: (r) => r.id,
        fsq: mem,
      })
    ).toThrow(/resolves outside the log directory/);
  });

  test('a complete but unterminated tail is NOT committed', () => {
    // A short write can persist the whole JSON object and lose only the
    // newline. The caller was told the append failed, so accepting this record
    // would resurrect a transaction the caller believes does not exist.
    mem.files.set(LOG, '{"id":"a","value":1}\n{"id":"b","value":2}');
    const store = makeStore();

    expect(store.readAll()).toEqual([{ id: 'a', value: 1 }]);
    expect(store.health().tornTail).toBe(true);
    expect(mem.files.get(LOG)).toBe('{"id":"a","value":1}\n');
    // The rejected bytes are kept for inspection rather than destroyed.
    const torn = [...mem.files.keys()].find((k) => k.includes('.torn-'))!;
    expect(mem.files.get(torn)).toBe('{"id":"b","value":2}');
  });

  test('refuses to append when the existing history could not be read', () => {
    mem.files.set(LOG, '{"id":"a","value":1}\n');
    mem.readFileSync.mockImplementation((p: string) => {
      if (p === LOG) throw new Error('EACCES: permission denied');
      throw new Error('ENOENT');
    });

    const store = makeStore();
    expect(store.readAll()).toEqual([]);
    // The cache is empty because the log is unreadable, not because it is
    // empty. Appending would start a fresh history over an existing one.
    expect(() => store.append({ id: 'b', value: 2 })).toThrow(/could not be read/);
  });

  test('does not re-migrate a legacy log after the live log is lost', () => {
    mem.files.set(LEGACY, JSON.stringify([{ id: 'old-1', value: 1 }]));
    const first = makeStore();
    expect(first.readAll()).toEqual([{ id: 'old-1', value: 1 }]);
    first.append({ id: 'new-1', value: 2 });
    expect(JSON.parse(mem.files.get(STATE)!)).toMatchObject({ count: 2, last: 'new-1' });

    // The live log is lost. Re-running the migration would rebuild the stale
    // snapshot and overwrite the newer watermark, hiding the loss entirely.
    mem.files.delete(LOG);
    const reopened = makeStore();

    expect(reopened.readAll()).toEqual([]);
    expect(reopened.health().ok).toBe(false);
    expect(reopened.health().reason).toContain('2 record(s) missing');
    expect(JSON.parse(mem.files.get(STATE)!).last).toBe('new-1');
  });

  test('persists a detected loss so ordinary use cannot erase it', () => {
    const store = makeStore();
    for (const id of ['a', 'b', 'c']) store.append({ id, value: 1 });

    // Truncate to one record, then record enough new ones to restore the count.
    mem.files.set(LOG, '{"id":"a","value":1}\n');
    const shortened = makeStore();
    expect(shortened.health().reason).toContain('2 record(s) missing');
    // The break reached the sidecar, not just this session's memory.
    expect(JSON.parse(mem.files.get(STATE)!).brokenAt).toBeGreaterThan(0);

    shortened.append({ id: 'd', value: 1 });
    shortened.append({ id: 'e', value: 1 });

    const later = makeStore();
    expect(later.readAll()).toHaveLength(3);
    // Counts line up again and the marker is present, so without the persisted
    // break this would now certify as intact.
    expect(later.health().ok).toBe(false);
  });

  test('copies a persistent corruption once, not on every launch', () => {
    mem.files.set(LOG, '{"id":"a","value":1}\ngarbage\n{"id":"b","value":2}\n');
    const first = makeStore();
    const path1 = first.health().quarantinePath!;
    expect(path1).toBeTruthy();

    // The damaged line stays in the live log by design, so every launch
    // re-detects it. Copying the whole log each time would fill the volume.
    const second = makeStore();
    const third = makeStore();
    expect(second.health().quarantinePath).toBe(path1);
    expect(third.health().quarantinePath).toBe(path1);
    expect([...mem.files.keys()].filter((k) => k.includes('.corrupt-'))).toHaveLength(1);
  });

  test('an unreadable watermark does not by itself condemn the log', () => {
    mem.files.set(LOG, '{"id":"a","value":1}\n');
    mem.files.set(STATE, 'not json at all');

    const store = makeStore();
    expect(store.readAll()).toHaveLength(1);
    expect(store.health().ok).toBe(true);
    expect(store.watermarkValue()).toBe('');
  });

  test('a watermark that is not an object is ignored', () => {
    mem.files.set(LOG, '{"id":"a","value":1}\n');
    mem.files.set(STATE, '["not", "an", "object"]');
    expect(makeStore().health().watermarkCount).toBe(0);
  });

  test('a log that cannot be read is reported unreadable, never as empty', () => {
    mem.files.set(LOG, '{"id":"a","value":1}\n');
    mem.readFileSync.mockImplementation((p: string) => {
      if (p === LOG) throw new Error('EACCES: permission denied');
      throw new Error('ENOENT');
    });

    const damage = jest.fn();
    const store = makeStore({ onDamage: damage });
    expect(store.readAll()).toEqual([]);
    const health = store.health();
    expect(health.ok).toBe(false);
    expect(health.reason).toContain('log unreadable');
    expect(damage).toHaveBeenCalled();
  });

  test('a legacy file that is not an array is treated as unreadable', () => {
    mem.files.set(LEGACY, '{"not":"an array"}');
    const store = makeStore();
    expect(store.readAll()).toEqual([]);
    expect(store.health().reason).toContain('legacy log is not an array');
  });

  test('legacy migration drops entries that are not records', () => {
    mem.files.set(LEGACY, JSON.stringify([{ id: 'a', value: 1 }, { nope: true }, null]));
    const store = makeStore();
    expect(store.readAll()).toEqual([{ id: 'a', value: 1 }]);
    expect(JSON.parse(mem.files.get(STATE)!)).toMatchObject({ count: 1, last: 'a' });
  });

  test('an empty legacy log migrates to an empty watermark', () => {
    mem.files.set(LEGACY, '[]');
    const store = makeStore();
    expect(store.readAll()).toEqual([]);
    expect(JSON.parse(mem.files.get(STATE)!)).toMatchObject({ count: 0, last: '' });
  });

  test('a store with no legacy file configured skips migration entirely', () => {
    mem.files.set(LEGACY, JSON.stringify([{ id: 'ignored', value: 9 }]));
    const store = makeStore({ legacyFileName: undefined });
    expect(store.readAll()).toEqual([]);
  });

  test('well-formed JSON that is not a record counts as corruption', () => {
    mem.files.set(LOG, '{"id":"a","value":1}\n{"wrong":"shape"}\n');
    const store = makeStore();
    expect(store.health().ok).toBe(false);
    expect(store.health().quarantinePath).toBeTruthy();
  });

  test('a trailing fragment that parses but is not a record is a torn tail', () => {
    mem.files.set(LOG, '{"id":"a","value":1}\n{"wrong":"shape"}');
    const store = makeStore();
    expect(store.readAll()).toEqual([{ id: 'a', value: 1 }]);
    expect(store.health().tornTail).toBe(true);
    // The fragment is preserved for inspection and removed from the live log.
    expect(mem.files.get(LOG)).toBe('{"id":"a","value":1}\n');
    expect([...mem.files.keys()].some((k) => k.includes('.torn-'))).toBe(true);
  });

  test('blank lines in the log are skipped without being called corruption', () => {
    mem.files.set(LOG, '{"id":"a","value":1}\n\n{"id":"b","value":2}\n');
    const store = makeStore();
    expect(store.readAll()).toHaveLength(2);
    expect(store.health().ok).toBe(true);
  });

  test('a torn tail that cannot be truncated is left for the next load to catch', () => {
    mem.files.set(LOG, '{"id":"a","value":1}\n{"id":"b"');
    mem.truncateSync.mockImplementation(() => {
      throw new Error('EPERM');
    });

    const store = makeStore();
    expect(store.readAll()).toEqual([{ id: 'a', value: 1 }]);
    expect(store.health().tornTail).toBe(true);

    // Appending still works, and the fragment survives as its own line so the
    // next load reports damage loudly rather than losing records.
    store.append({ id: 'c', value: 3 });
    expect(mem.files.get(LOG)).toContain('{"id":"b"\n{"id":"c","value":3}\n');
  });

  test('a damaged log that cannot be copied aside still reports the damage', () => {
    mem.files.set(LOG, 'garbage line\n{"id":"a","value":1}\n');
    mem.failOpen((p) => p.includes('.corrupt-'), 'EROFS');

    const store = makeStore();
    const health = store.health();
    expect(health.ok).toBe(false);
    expect(health.reason).toContain('could not be copied aside');
    expect(health.quarantinePath).toBeNull();
    // The surviving record stays readable either way: preserving evidence must
    // not cost the records that are still a required register.
    expect(store.readAll()).toEqual([{ id: 'a', value: 1 }]);
  });

  test('a damaged log keeps its surviving records live and appendable', () => {
    mem.files.set(LOG, '{"id":"a","value":1}\ngarbage line\n{"id":"b","value":2}\n');
    const store = makeStore();

    expect(store.readAll()).toEqual([
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
    ]);
    const quarantined = store.health().quarantinePath!;
    // A copy, not a move: the live log is intact on disk.
    expect(mem.files.get(quarantined)).toContain('garbage line');
    expect(mem.files.get(LOG)).toContain('garbage line');

    store.append({ id: 'c', value: 3 });
    expect(store.readAll()).toHaveLength(3);
    // ...and it never goes back to claiming to be healthy.
    expect(store.health().ok).toBe(false);
  });

  test('the damage report survives a failed watermark update', () => {
    mem.files.set(LOG, 'garbage line\n{"id":"a","value":1}\n');
    const realOpen = mem.openSync.getMockImplementation()!;
    mem.openSync.mockImplementation((p: string, flags: string) => {
      if (p.includes('.state.json')) throw new Error('ENOSPC');
      return realOpen(p, flags);
    });

    const health = makeStore().health();
    expect(health.ok).toBe(false);
    expect(health.quarantinePath).toBeTruthy();
  });

  test('a previously recorded break is remembered and reported', () => {
    mem.files.set(STATE, JSON.stringify({ count: 0, last: '', brokenAt: 42 }));
    expect(makeStore().health().reason).toBe('log was previously found damaged');
  });

  test('an earlier quarantine path is surfaced on later loads', () => {
    mem.files.set(LOG, '{"id":"a","value":1}\n');
    mem.files.set(
      STATE,
      JSON.stringify({ count: 1, last: 'a', brokenAt: 42, quarantined: ['/old/corrupt-1'] })
    );
    expect(makeStore().health().quarantinePath).toBe('/old/corrupt-1');
  });

  test('a record stays durable even when the watermark cannot be updated', () => {
    const store = makeStore();
    store.append({ id: 'a', value: 1 });

    const realOpen = mem.openSync.getMockImplementation()!;
    mem.openSync.mockImplementation((p: string, flags: string) => {
      if (p.includes('.state.json')) throw new Error('ENOSPC');
      return realOpen(p, flags);
    });

    expect(() => store.append({ id: 'b', value: 2 })).not.toThrow();
    expect(mem.files.get(LOG)).toContain('{"id":"b","value":2}');
    expect(store.readAll()).toHaveLength(2);
  });

  test('the default clock is used when none is injected', () => {
    mem.files.set(LOG, 'garbage\n{"id":"a","value":1}\n');
    const store = createJsonlStore<Rec>({
      dirPath: DIR,
      fileName: 'log.jsonl',
      isRecord: isRec,
      watermarkOf: (r) => r.id,
      fsq: mem,
    });
    const quarantined = store.health().quarantinePath!;
    expect(Number(quarantined.split('.corrupt-')[1])).toBeGreaterThan(1_600_000_000_000);
  });

  describe('path containment', () => {
    test.each([
      ['a relative traversal', '../../../etc/passwd'],
      ['a traversal that re-enters', 'subdir/../../etc/passwd'],
      ['a leading current-directory traversal', './../../sensitive'],
    ])('refuses a file name that is %s', (_label, fileName) => {
      expect(() => makeStore({ fileName })).toThrow(/resolves outside the log directory/);
    });

    // The store's sidecars are built by concatenation rather than through
    // containedPath, so the write itself is the only place that can hold this.
    // Built with template strings, not path.join: joining normalises the
    // traversal away, which is precisely why the guard reads raw segments.
    test.each([
      ['a trailing traversal segment', `${DIR}/../escaped.jsonl`],
      ['a traversal in the middle', `${DIR}/nested/../../escaped.jsonl`],
      ['a Windows-separated traversal', `${DIR}\\..\\escaped.jsonl`],
    ])('refuses a write to a path with %s', (_label, filePath) => {
      expect(() => assertSafeFilePath(filePath)).toThrow(/escapes its directory/);
    });

    // The guard must not reject the absolute paths the store legitimately
    // writes: containedPath returns one whenever dirPath is absolute, which it
    // is in the packaged app.
    test('accepts the absolute paths the store actually writes', () => {
      const store = makeStore();
      store.append({ id: 'a', value: 1 });

      const written = [...mem.files.keys()];
      expect(written).toContain(LOG);
      for (const filePath of written) {
        expect(path.isAbsolute(filePath)).toBe(true);
        expect(() => assertSafeFilePath(filePath)).not.toThrow();
      }
    });

    test('accepts the concatenated sidecar paths', () => {
      for (const suffix of [
        '.tmp',
        '.state.json',
        '.corrupt-1700000000000',
        '.torn-1700000000000',
        '.migrating',
      ]) {
        expect(() => assertSafeFilePath(`${LOG}${suffix}`)).not.toThrow();
      }
    });
  });
});
