import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createJsonlStore } from '../src/compliance/durable-log';
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
});
