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
  /** Where a damaged file was moved to, so an operator can recover it. */
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
  ...(partial || {}),
});

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

/** Replaces a small sidecar file atomically (write temp, fsync, rename). */
const replaceAtomically = (fsq: DurableLogFs, filePath: string, data: string): void => {
  const tmpPath = `${filePath}.tmp`;
  writeDurably(fsq, tmpPath, data, 'w');
  fsq.renameSync(tmpPath, filePath);
};

export const createJsonlStore = <T>(opts: JsonlStoreOptions<T>): JsonlStore<T> => {
  const fsq = resolveFs(opts.fsq);
  const now = opts.now || (() => Date.now());
  const filePath = path.join(opts.dirPath, opts.fileName);
  const statePath = path.join(opts.dirPath, `${opts.fileName}.state.json`);
  const legacyPath = opts.legacyFileName ? path.join(opts.dirPath, opts.legacyFileName) : null;

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
    replaceAtomically(fsq, statePath, JSON.stringify(state));
  };

  /**
   * Moves a damaged log aside instead of appending onto it. The replacement log
   * is NOT presented as an intact genesis chain: `brokenAt` is persisted in the
   * watermark so health() keeps reporting the break after restart.
   */
  const quarantine = (reason: string, priorState: WatermarkFile): string | null => {
    const quarantinePath = `${filePath}.corrupt-${now()}`;
    try {
      fsq.renameSync(filePath, quarantinePath);
    } catch {
      return null;
    }
    try {
      writeState({
        count: priorState.count ?? 0,
        last: priorState.last ?? '',
        brokenAt: now(),
        reason,
        quarantined: [...(priorState.quarantined || []), quarantinePath],
      });
    } catch {
      // The rename already preserved the evidence; a failed watermark update
      // must not throw away the in-memory damage report.
    }
    return quarantinePath;
  };

  /**
   * Converts a legacy whole-array log into the append-only format. Written to a
   * temp file and renamed, so an interrupted migration leaves the legacy file
   * untouched and is simply retried on the next launch.
   */
  const migrateLegacy = (): string | null => {
    if (!legacyPath || fsq.existsSync(filePath) || !fsq.existsSync(legacyPath)) return null;
    const raw = String(fsq.readFileSync(legacyPath, 'utf8'));
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('legacy log is not an array');
    const valid = parsed.filter(opts.isRecord);
    const body = valid.map((r) => `${JSON.stringify(r)}\n`).join('');
    fsq.mkdirSync(opts.dirPath, { recursive: true });
    const tmpPath = `${filePath}.migrating`;
    writeDurably(fsq, tmpPath, body, 'w');
    fsq.renameSync(tmpPath, filePath);
    const lastValid = valid.length > 0 ? valid[valid.length - 1]! : null;
    writeState({ count: valid.length, last: lastValid ? opts.watermarkOf(lastValid) : '' });
    return raw;
  };

  const parseLines = (
    raw: string
  ): { parsed: T[]; tornTail: string | null; midFileCorruption: boolean } => {
    const lines = raw.split('\n');
    const trailing = lines.pop() ?? '';
    const parsed: T[] = [];
    let midFileCorruption = false;

    for (const line of lines) {
      if (line.trim() === '') continue;
      try {
        const value: unknown = JSON.parse(line);
        if (opts.isRecord(value)) parsed.push(value);
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
        if (opts.isRecord(value)) parsed.push(value);
        else tornTail = trailing;
      } catch {
        tornTail = trailing;
      }
    }

    return { parsed, tornTail, midFileCorruption };
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

  const load = (): T[] => {
    if (records) return records;
    const state = readState();
    const watermarkCount = state.count ?? 0;

    let raw = '';
    try {
      const migrated = migrateLegacy();
      if (migrated !== null) {
        raw = fsq.existsSync(filePath) ? String(fsq.readFileSync(filePath, 'utf8')) : '';
      } else if (fsq.existsSync(filePath)) {
        raw = String(fsq.readFileSync(filePath, 'utf8'));
      }
    } catch (error) {
      // The file exists but cannot be read or migrated. Reporting "no records"
      // here is what lets a wiped register look like a clean install, so the log
      // is marked unreadable and callers must treat it as untrustworthy.
      records = [];
      health = {
        ok: false,
        reason: `log unreadable: ${(error as Error).message}`,
        quarantinePath: null,
        recordsLoaded: 0,
        watermarkCount,
        tornTail: false,
      };
      opts.onDamage?.(health);
      return records;
    }

    const { parsed, tornTail, midFileCorruption } = parseLines(raw);
    endsWithNewline = raw === '' || raw.endsWith('\n');
    records = parsed;

    if (tornTail !== null && dropTornTail(raw, tornTail)) endsWithNewline = true;

    let quarantinePath: string | null = null;
    const reasons: string[] = [];
    if (midFileCorruption) {
      quarantinePath = quarantine('unparseable record inside the log', state);
      reasons.push(
        quarantinePath
          ? `unparseable records found; damaged log moved to ${quarantinePath}`
          : 'unparseable records found and the damaged log could not be quarantined'
      );
      // The damaged file was moved aside; the live log restarts empty but is
      // never reported as an intact history.
      if (quarantinePath) {
        records = [];
        endsWithNewline = true;
      }
    }
    if (state.brokenAt) {
      reasons.push(state.reason || 'log was previously found damaged');
    }
    if (records.length < watermarkCount) {
      reasons.push(
        `${watermarkCount - records.length} record(s) missing (expected ${watermarkCount}, found ${records.length})`
      );
    }
    if (tornTail !== null) {
      reasons.push('the final record was written incompletely and was discarded');
    }

    const priorQuarantine = state.quarantined || [];
    health = {
      ok: reasons.length === 0,
      reason: reasons.length ? reasons.join('; ') : null,
      quarantinePath:
        quarantinePath ?? (priorQuarantine.length ? priorQuarantine[priorQuarantine.length - 1]! : null),
      recordsLoaded: records.length,
      watermarkCount,
      tornTail: tornTail !== null,
    };
    if (!health.ok) opts.onDamage?.(health);
    return records;
  };

  const append = (record: T): void => {
    const current = load();
    fsq.mkdirSync(opts.dirPath, { recursive: true });
    // A torn tail has no newline of its own; without this separator the new
    // record would be concatenated onto the fragment and lost as well.
    const payload = `${endsWithNewline ? '' : '\n'}${JSON.stringify(record)}\n`;
    writeDurably(fsq, filePath, payload, 'a');
    // Only after the bytes are durable does the in-memory view advance. Doing
    // this first is how a failed write ends up reported to the user as a
    // successful, signed record.
    endsWithNewline = true;
    current.push(record);
    health = { ...health, recordsLoaded: current.length };
    try {
      const state = readState();
      writeState({
        ...state,
        count: Math.max(current.length, state.count ?? 0),
        last: opts.watermarkOf(record),
      });
      health = { ...health, watermarkCount: Math.max(current.length, state.count ?? 0) };
    } catch {
      // The record itself is durable. A stale watermark can only under-report
      // the expected count, which never turns loss into a clean bill of health.
    }
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
