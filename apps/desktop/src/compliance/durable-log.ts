'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';

/**
 * Append-only, crash-durable record store shared by the DEA compliance logs.
 *
 * Rewriting a whole JSON array on every append is not survivable: a crash or a
 * short write between truncate and completion leaves truncated JSON, the next
 * launch parses it as "empty", and the following append overwrites every
 * surviving record. That is silent, total loss of a federally required record.
 *
 * This store instead writes one JSON object per line with O_APPEND + fsync, so
 * an interrupted write can only ever damage the final line. It also persists a
 * watermark (record count + a caller-chosen last-record marker) next to the log
 * so that a log which has been shortened, replaced or deleted is *detectable*
 * rather than indistinguishable from a fresh install.
 */

export interface DurableLogFs {
  readFileSync: typeof fs.readFileSync;
  mkdirSync: typeof fs.mkdirSync;
  existsSync: typeof fs.existsSync;
  openSync: (filePath: string, flags: string, mode?: number) => number;
  writeSync: (fd: number, data: string) => number;
  fsyncSync: (fd: number) => void;
  closeSync: (fd: number) => void;
  renameSync: (from: string, to: string) => void;
  truncateSync: (filePath: string, length: number) => void;
}

/**
 * Why a log is not trustworthy. `null` reason means the log is intact as far as
 * this store can tell.
 */
export interface JsonlHealth {
  ok: boolean;
  reason: string | null;
  /** Where a copy of a damaged file was placed, so an operator can recover it. */
  quarantinePath: string | null;
  /** Records successfully parsed out of the live log file. */
  recordsLoaded: number;
  /** Highest record count ever persisted. A larger value means records were lost. */
  watermarkCount: number;
  /** True when the final line was incomplete (interrupted write) and was skipped. */
  tornTail: boolean;
}

export interface JsonlStore<T> {
  readAll: () => T[];
  /** Durably appends one record. Throws if the record did not reach the disk. */
  append: (record: T) => void;
  health: () => JsonlHealth;
  /** The last-record marker persisted alongside the log ('' when never written). */
  watermarkValue: () => string;
}

export interface JsonlStoreOptions<T> {
  dirPath: string;
  /** Base name of the append-only log, e.g. `audit-log.jsonl`. */
  fileName: string;
  /** Legacy whole-array JSON file to migrate from, if one is present. */
  legacyFileName?: string;
  isRecord: (value: unknown) => value is T;
  /** Stable marker for a record (a signature or id) stored in the watermark. */
  watermarkOf: (record: T) => string;
  fsq?: Partial<DurableLogFs>;
  now?: () => number;
  /** Called when the store detects damage. Never throws into the caller. */
  onDamage?: (health: JsonlHealth) => void;
}

interface WatermarkFile {
  count?: number;
  last?: string;
  brokenAt?: number;
  reason?: string;
  quarantined?: string[];
}

const defaultFs = (): DurableLogFs => ({
  readFileSync: fs.readFileSync,
  mkdirSync: fs.mkdirSync,
  existsSync: fs.existsSync,
  openSync: fs.openSync,
  writeSync: (fd, data) => fs.writeSync(fd, data),
  fsyncSync: fs.fsyncSync,
  closeSync: fs.closeSync,
  renameSync: fs.renameSync,
  truncateSync: fs.truncateSync,
});

const resolveFs = (partial?: Partial<DurableLogFs>): DurableLogFs => ({
  ...defaultFs(),
  ...partial,
});

/**
 * Builds a path inside `dirPath` and refuses any name that would escape it.
 *
 * Every filename this module touches is derived from a caller-supplied base
 * name, so a name containing traversal segments would let the store read or
 * overwrite a file outside the compliance data directory. The returned path
 * keeps the caller's shape (relative stays relative) so injected filesystems
 * still see the paths they expect.
 */
const containedPath = (dirPath: string, name: string): string => {
  const base = path.resolve(dirPath);
  const target = path.resolve(base, name);
  const relative = path.relative(base, target);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`refusing to use "${name}": it resolves outside the log directory`);
  }
  return path.join(dirPath, name);
};

/**
 * Writes `data` to `filePath` and returns only once the bytes are on the
 * platter. A short write is an error: silently persisting half a record is the
 * failure mode this module exists to remove.
 */
const writeDurably = (fsq: DurableLogFs, filePath: string, data: string, flags: string): void => {
  const fd = fsq.openSync(filePath, flags, 0o600);
  try {
    const written = fsq.writeSync(fd, data);
    const expected = Buffer.byteLength(data, 'utf8');
    if (typeof written === 'number' && written < expected) {
      throw new Error(`short write: ${written}/${expected} bytes to ${filePath}`);
    }
    fsq.fsyncSync(fd);
  } finally {
    fsq.closeSync(fd);
  }
};

/**
 * fsyncs the directory itself. Syncing a file does not make its *directory
 * entry* durable on POSIX filesystems, so a create or rename can still vanish
 * after power loss even though the write returned. Best effort: Windows has no
 * equivalent and rejects the open, which is not an error worth propagating.
 */
const syncDirectory = (fsq: DurableLogFs, dirPath: string): void => {
  try {
    const fd = fsq.openSync(dirPath, 'r');
    try {
      fsq.fsyncSync(fd);
    } finally {
      fsq.closeSync(fd);
    }
  } catch {
    // Not supported on this platform; the file data itself is already synced.
  }
};

/** Replaces a small sidecar file atomically (write temp, fsync, rename, sync dir). */
const replaceAtomically = (
  fsq: DurableLogFs,
  dirPath: string,
  filePath: string,
  data: string
): void => {
  const tmpPath = `${filePath}.tmp`;
  writeDurably(fsq, tmpPath, data, 'w');
  fsq.renameSync(tmpPath, filePath);
  syncDirectory(fsq, dirPath);
};

interface ParsedLog<T> {
  parsed: T[];
  /** The incomplete final line, or null when the file ends cleanly. */
  tornTail: string | null;
  midFileCorruption: boolean;
}

const parseLines = <T>(raw: string, isRecord: (v: unknown) => v is T): ParsedLog<T> => {
  const lines = raw.split('\n');
  const trailing = lines.pop() ?? '';
  const parsed: T[] = [];
  let midFileCorruption = false;

  for (const line of lines) {
    if (line.trim() === '') continue;
    try {
      const value: unknown = JSON.parse(line);
      if (isRecord(value)) parsed.push(value);
      else midFileCorruption = true;
    } catch {
      midFileCorruption = true;
    }
  }

  // The trailing fragment has no terminating newline, so an interrupted append
  // can only have damaged this one. Keep it if it happens to be complete.
  let tornTail: string | null = null;
  if (trailing.trim() !== '') {
    try {
      const value: unknown = JSON.parse(trailing);
      if (isRecord(value)) parsed.push(value);
      else tornTail = trailing;
    } catch {
      tornTail = trailing;
    }
  }

  return { parsed, tornTail, midFileCorruption };
};

export const createJsonlStore = <T>(opts: JsonlStoreOptions<T>): JsonlStore<T> => {
  const fsq = resolveFs(opts.fsq);
  const now = opts.now || (() => Date.now());
  const filePath = containedPath(opts.dirPath, opts.fileName);
  const statePath = containedPath(opts.dirPath, `${opts.fileName}.state.json`);
  const legacyPath = opts.legacyFileName
    ? containedPath(opts.dirPath, opts.legacyFileName)
    : null;

  let records: T[] | null = null;
  let endsWithNewline = true;
  let health: JsonlHealth = {
    ok: true,
    reason: null,
    quarantinePath: null,
    recordsLoaded: 0,
    watermarkCount: 0,
    tornTail: false,
  };
  /** Set when a record reached the log but its watermark update did not. */
  let watermarkStale: string | null = null;

  const readState = (): WatermarkFile => {
    try {
      if (!fsq.existsSync(statePath)) return {};
      const parsed: unknown = JSON.parse(String(fsq.readFileSync(statePath, 'utf8')));
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
      return parsed as WatermarkFile;
    } catch {
      // An unreadable watermark weakens loss detection but must not, by itself,
      // make the log look damaged. The chain/HMAC checks still apply.
      return {};
    }
  };

  const writeState = (state: WatermarkFile): void => {
    replaceAtomically(fsq, opts.dirPath, statePath, JSON.stringify(state));
  };

  /**
   * Copies a damaged log aside and records the break in the watermark.
   *
   * The damaged file is copied, not moved: the records that did survive are
   * still a legally required register and must stay readable and appendable.
   * Moving the file would preserve the evidence at the cost of the surviving
   * data, which is the wrong trade for a DEA log. `brokenAt` is persisted so
   * health() keeps reporting the break after a restart, and the log is never
   * presented as an intact history again.
   */
  const preserveDamaged = (raw: string, reason: string, priorState: WatermarkFile): string | null => {
    const quarantinePath = `${filePath}.corrupt-${now()}`;
    try {
      writeDurably(fsq, quarantinePath, raw, 'w');
      syncDirectory(fsq, opts.dirPath);
    } catch {
      return null;
    }
    try {
      writeState({
        ...priorState,
        count: priorState.count ?? 0,
        last: priorState.last ?? '',
        brokenAt: now(),
        reason,
        quarantined: [...(priorState.quarantined || []), quarantinePath],
      });
    } catch {
      // The copy already preserved the evidence; a failed watermark update must
      // not throw away the in-memory damage report.
    }
    return quarantinePath;
  };

  /**
   * Converts a legacy whole-array log into the append-only format. Written to a
   * temp file and renamed, so an interrupted migration leaves the legacy file
   * untouched and is simply retried on the next launch.
   */
  const migrateLegacy = (): boolean => {
    if (!legacyPath || fsq.existsSync(filePath) || !fsq.existsSync(legacyPath)) return false;
    const parsed: unknown = JSON.parse(String(fsq.readFileSync(legacyPath, 'utf8')));
    if (!Array.isArray(parsed)) throw new Error('legacy log is not an array');
    const valid = parsed.filter(opts.isRecord);
    const body = valid.map((r) => `${JSON.stringify(r)}\n`).join('');
    fsq.mkdirSync(opts.dirPath, { recursive: true });
    const tmpPath = `${filePath}.migrating`;
    writeDurably(fsq, tmpPath, body, 'w');
    fsq.renameSync(tmpPath, filePath);
    syncDirectory(fsq, opts.dirPath);
    const lastValid = valid.length > 0 ? valid[valid.length - 1]! : null;
    writeState({ count: valid.length, last: lastValid ? opts.watermarkOf(lastValid) : '' });
    return true;
  };

  /**
   * Drops an incomplete final record, after copying it aside for forensics.
   *
   * The fragment cannot simply be left in place: once a further record is
   * appended after it, it stops being the *last* line and would then read as
   * mid-file corruption, quarantining an otherwise healthy log. The fragment was
   * never acknowledged to any caller, so discarding it loses nothing.
   */
  const dropTornTail = (raw: string, fragment: string): boolean => {
    const keepBytes = Buffer.byteLength(raw, 'utf8') - Buffer.byteLength(fragment, 'utf8');
    try {
      writeDurably(fsq, `${filePath}.torn-${now()}`, fragment, 'w');
      fsq.truncateSync(filePath, keepBytes);
      return true;
    } catch {
      // Leaving the fragment is survivable: the next load sees it as mid-file
      // damage and quarantines loudly rather than losing records silently.
      return false;
    }
  };

  /** Reads the live log, migrating a legacy array file first if one is present. */
  const readRaw = (): string => {
    const migrated = migrateLegacy();
    if (!migrated && !fsq.existsSync(filePath)) return '';
    return String(fsq.readFileSync(filePath, 'utf8'));
  };

  const unreadable = (message: string, watermarkCount: number): JsonlHealth => ({
    ok: false,
    reason: `log unreadable: ${message}`,
    quarantinePath: null,
    recordsLoaded: 0,
    watermarkCount,
    tornTail: false,
  });

  /**
   * Everything that makes a successfully parsed log untrustworthy: damage found
   * now, damage recorded on an earlier run, and records the watermark says
   * should be here but are not.
   */
  const damageReasons = (
    state: WatermarkFile,
    loaded: T[],
    tornTail: string | null,
    quarantinePath: string | null,
    quarantineFailed: boolean
  ): string[] => {
    const reasons: string[] = [];
    if (quarantinePath)
      reasons.push(`unparseable records found; a copy of the damaged log is at ${quarantinePath}`);
    else if (quarantineFailed)
      reasons.push('unparseable records found and the damaged log could not be copied aside');
    if (state.brokenAt) reasons.push(state.reason || 'log was previously found damaged');

    const expected = state.count ?? 0;
    if (loaded.length < expected) {
      reasons.push(
        `${expected - loaded.length} record(s) missing (expected ${expected}, found ${loaded.length})`
      );
    }
    // Count alone cannot catch a same-length replacement (a restored backup, a
    // rolled-back file). The marker of the last acknowledged record must still
    // be present somewhere in the log.
    const marker = state.last ?? '';
    if (marker !== '' && !loaded.some((r) => opts.watermarkOf(r) === marker)) {
      reasons.push('the last recorded entry is missing: the log has been replaced');
    }
    if (tornTail !== null) reasons.push('the final record was written incompletely and was discarded');
    if (watermarkStale) reasons.push(watermarkStale);
    return reasons;
  };

  const load = (): T[] => {
    if (records) return records;
    const state = readState();
    const watermarkCount = state.count ?? 0;

    let raw: string;
    try {
      raw = readRaw();
    } catch (error) {
      // The file exists but cannot be read or migrated. Reporting "no records"
      // here is what lets a wiped register look like a clean install, so the log
      // is marked unreadable and callers must treat it as untrustworthy.
      records = [];
      health = unreadable((error as Error).message, watermarkCount);
      opts.onDamage?.(health);
      return records;
    }

    const { parsed, tornTail, midFileCorruption } = parseLines(raw, opts.isRecord);
    endsWithNewline = raw === '' || raw.endsWith('\n');
    records = parsed;
    if (tornTail !== null && dropTornTail(raw, tornTail)) endsWithNewline = true;

    // The parseable records stay live and appendable; only a copy is set aside.
    const quarantinePath = midFileCorruption
      ? preserveDamaged(raw, 'unparseable record inside the log', state)
      : null;

    const reasons = damageReasons(
      state,
      records,
      tornTail,
      quarantinePath,
      midFileCorruption && quarantinePath === null
    );
    const priorQuarantine = state.quarantined || [];
    health = {
      ok: reasons.length === 0,
      reason: reasons.length ? reasons.join('; ') : null,
      quarantinePath:
        quarantinePath ??
        (priorQuarantine.length ? priorQuarantine[priorQuarantine.length - 1]! : null),
      recordsLoaded: records.length,
      watermarkCount,
      tornTail: tornTail !== null,
    };
    if (!health.ok) opts.onDamage?.(health);
    return records;
  };

  /** Advances the sidecar watermark. Flags the store degraded if it cannot. */
  const advanceWatermark = (record: T, count: number): void => {
    try {
      const state = readState();
      const nextCount = Math.max(count, state.count ?? 0);
      writeState({ ...state, count: nextCount, last: opts.watermarkOf(record) });
      health = { ...health, watermarkCount: nextCount };
    } catch (error) {
      // The record itself is durable, but a stale watermark cannot prove a
      // *later* loss of it, so the store must stop claiming to be healthy.
      watermarkStale = `the loss-detection watermark could not be updated (${(error as Error).message}), so missing records may go undetected`;
      health = { ...health, ok: false, reason: watermarkStale };
      opts.onDamage?.(health);
    }
  };

  const append = (record: T): void => {
    const current = load();
    fsq.mkdirSync(opts.dirPath, { recursive: true });
    const isNewFile = !fsq.existsSync(filePath);
    // A torn tail has no newline of its own; without this separator the new
    // record would be concatenated onto the fragment and lost as well.
    const payload = `${endsWithNewline ? '' : '\n'}${JSON.stringify(record)}\n`;
    try {
      writeDurably(fsq, filePath, payload, 'a');
    } catch (error) {
      // A short write leaves a partial line behind. Assume the worst so that a
      // retry starts on a fresh line instead of being spliced onto the
      // fragment, which would corrupt the retry as well as the original.
      endsWithNewline = false;
      throw error;
    }
    if (isNewFile) syncDirectory(fsq, opts.dirPath);
    // Only after the bytes are durable does the in-memory view advance. Doing
    // this first is how a failed write ends up reported to the user as a
    // successful, signed record.
    endsWithNewline = true;
    current.push(record);
    health = { ...health, recordsLoaded: current.length };
    advanceWatermark(record, current.length);
  };

  return {
    readAll: load,
    append,
    health: () => {
      load();
      return health;
    },
    watermarkValue: () => readState().last ?? '',
  };
};
