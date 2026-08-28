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
  /** Set once the legacy array log has been converted. Never migrate twice. */
  migratedAt?: number;
}

const CORRUPTION_REASON = 'unparseable record inside the log';

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
const assertSafeDirectory = (dirPath: string): void => {
  // The controlled-substance logbook already refused a traversing directory;
  // the audit log had no such guard, so this applies the same rule to every
  // store. A ".." segment means the configured data directory is not the one
  // being written to.
  const segments = path.normalize(dirPath).split(/[\\/]+/);
  if (segments.includes('..')) {
    throw new Error(`refusing to use "${dirPath}": the log directory escapes its parent`);
  }
};

export const containedPath = (dirPath: string, name: string): string => {
  assertSafeDirectory(dirPath);
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
  if (filePath.includes('..') || path.isAbsolute(filePath)) {
    throw new Error('Invalid file path');
  }
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
    assertSafeDirectory(dirPath);
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

  // The terminating newline IS the commit marker. A record is written as
  // `json + "\n"` in one write followed by fsync, so a complete record always
  // carries its newline; a trailing fragment without one means the write did
  // not finish, whether or not the JSON happens to parse. Accepting a
  // parseable-but-unterminated tail would commit a record whose caller was
  // explicitly told the append failed - resurrecting a controlled-substance
  // transaction after its `:not-recorded` compensation was already written.
  const tornTail = trailing.trim() === '' ? null : trailing;

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
  /** Set when the existing history could not be read. Blocks all appends. */
  let unreadableReason: string | null = null;

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
    // The damaged line is deliberately left in the live log, so every launch
    // re-detects it. Copying the whole compliance log each time would grow
    // without bound and eventually fill the volume, which would itself start
    // failing compliance writes. One copy per break is enough; the sidecar
    // already carries the break and the path to the copy.
    const alreadyPreserved = priorState.quarantined?.[priorState.quarantined.length - 1];
    if (priorState.brokenAt && alreadyPreserved) return alreadyPreserved;

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
  const migrateLegacy = (state: WatermarkFile): boolean => {
    if (!legacyPath || fsq.existsSync(filePath) || !fsq.existsSync(legacyPath)) return false;
    // The legacy array is kept after migration rather than deleted. If the live
    // log is later lost - the very loss the watermark exists to detect -
    // re-running the migration would rebuild an old snapshot and overwrite the
    // newer count and marker with the legacy ones, so every record added since
    // the original migration would vanish while the store reported itself
    // healthy. A watermark proving a newer log existed means this is loss, not
    // a first run.
    if (state.migratedAt !== undefined || state.count !== undefined) return false;
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
    writeState({
      count: valid.length,
      last: lastValid ? opts.watermarkOf(lastValid) : '',
      migratedAt: now(),
    });
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
  const readRaw = (state: WatermarkFile): string => {
    const migrated = migrateLegacy(state);
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
    // Kept short and stable so it matches what gets persisted: the freshly
    // detected reason and the one replayed from the sidecar must collapse to
    // one line rather than stacking on every launch. The path to the copy is
    // reported separately as health.quarantinePath.
    if (quarantinePath) reasons.push(CORRUPTION_REASON);
    else if (quarantineFailed)
      reasons.push('unparseable record inside the log, which could not be copied aside');
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
    return [...new Set(reasons)];
  };

  const load = (): T[] => {
    if (records) return records;
    const state = readState();
    const watermarkCount = state.count ?? 0;

    let raw: string;
    try {
      raw = readRaw(state);
    } catch (error) {
      // The file exists but cannot be read or migrated. Reporting "no records"
      // here is what lets a wiped register look like a clean install, so the log
      // is marked unreadable and callers must treat it as untrustworthy.
      records = [];
      unreadableReason = (error as Error).message;
      health = unreadable(unreadableReason, watermarkCount);
      opts.onDamage?.(health);
      return records;
    }

    const { parsed, tornTail, midFileCorruption } = parseLines(raw, opts.isRecord);
    endsWithNewline = raw === '' || raw.endsWith('\n');
    records = parsed;
    if (tornTail !== null && dropTornTail(raw, tornTail)) endsWithNewline = true;

    // The parseable records stay live and appendable; only a copy is set aside.
    const quarantinePath = midFileCorruption
      ? preserveDamaged(raw, CORRUPTION_REASON, state)
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
    if (!health.ok) {
      // A detected loss that lives only in memory is erased by ordinary use:
      // once enough new records replace the missing ones the count matches
      // again, the marker is present, and the shortened log certifies as
      // intact. Persist the break so it outlives the session that saw it.
      // Re-read rather than reusing the snapshot taken at the top of load():
      // preserveDamaged may have written brokenAt and the quarantine path since
      // then, and writing a stale copy back would erase them.
      const current = readState();
      if (!current.brokenAt && health.reason) {
        try {
          writeState({ ...current, brokenAt: now(), reason: health.reason });
        } catch {
          // Best effort: the in-memory report still stands for this session.
        }
      }
      opts.onDamage?.(health);
    }
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
    if (unreadableReason !== null) {
      // The cache is empty because the history could not be READ, not because
      // there is none. Appending here would sign an audit entry with a genesis
      // prevSignature over a log that still exists, and would report a
      // controlled-substance register that omits every prior transaction.
      throw new Error(
        `refusing to append: the existing log could not be read (${unreadableReason})`
      );
    }
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
