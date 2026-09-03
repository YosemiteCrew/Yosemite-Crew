'use strict';

import fs from 'node:fs';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import {
  containedPath,
  createJsonlStore,
  type DurableLogFs,
  type JsonlHealth,
} from './durable-log';

export interface AuditEntry {
  id: string;
  timestamp: number;
  action: string;
  actor: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
  // Signature of the previous entry, linking entries into a tamper-evident
  // chain (empty string for the genesis entry).
  prevSignature: string;
  signature: string;
  /**
   * Which key signed this entry - a truncated HMAC of a fixed label under that
   * key, so it identifies the key without being usable to recover it.
   *
   * Optional because entries written before this existed carry none. Its
   * absence means "unknown key", which is treated exactly like a foreign one:
   * unverifiable, not tampered.
   *
   * Without it a degraded session was unattributable after the fact. The
   * keychain being unreadable is handled at startup - the stored key is left
   * alone and the session signs with a temporary one - but nothing recorded
   * WHICH entries that applied to, so once the keychain recovered those rows
   * failed verify() forever and the trail reported "Tampered" with no
   * explanation. On the controlled-substance register that is a compliance
   * alarm nobody can clear (#2553).
   */
  keyId?: string;
}

/**
 * Thrown when an audit entry could not be written to disk. An audit entry that
 * only exists in memory is not an audit entry, so this must reach the caller.
 */
export class AuditWriteError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'AuditWriteError';
  }
}

export interface AuditLog {
  append: (
    entry: Omit<AuditEntry, 'id' | 'timestamp' | 'signature' | 'prevSignature'>
  ) => AuditEntry;
  query: (opts?: {
    resourceType?: string;
    resourceId?: string;
    since?: number;
    limit?: number;
  }) => AuditEntry[];
  getByResource: (resourceType: string, resourceId: string) => AuditEntry[];
  getByActor: (actor: string) => AuditEntry[];
  getRange: (start: number, end: number) => AuditEntry[];
  size: () => number;
  verify: (entry: AuditEntry) => boolean;
  /** `otherKey` are entries a different signing key produced - unverifiable
   *  here, and explicitly not tampered. */
  verifyAll: () => { valid: number; tampered: number; otherKey: number };
  // Verifies the full hash chain: each entry's stored prevSignature must match
  // the actual prior entry, catching deletion, insertion and reordering.
  //
  // A walk over the surviving entries alone cannot detect a log that was
  // shortened from the front, so this also compares the loaded entries against
  // the persisted watermark. Without that, a one-entry log left behind by a
  // truncating crash walks cleanly and certifies a wiped history as intact.
  verifyChain: () => boolean;
  /** Whether the log on disk can be trusted, and why not when it cannot. */
  getIntegrity: () => AuditIntegrity;
}

export interface AuditIntegrity extends JsonlHealth {
  /**
   * `session-only` means the stored HMAC key could not be read, so this session
   * signs with a temporary key. Historical entries then fail verify() because
   * they were signed with a different key, which is NOT evidence of tampering
   * and must not be reported as such.
   */
  signingKey: 'persisted' | 'session-only';
}

// OS-backed encryption (Electron safeStorage). Injectable for tests.
export interface SecureStore {
  isEncryptionAvailable: () => boolean;
  encryptString: (plain: string) => Buffer;
  decryptString: (encrypted: Buffer) => string;
}

interface AuditDeps extends Partial<DurableLogFs> {
  writeFileSync?: typeof fs.writeFileSync;
  now?: () => number;
  // HMAC key. If omitted, a random per-install key is created and persisted
  // alongside the log (encrypted at rest via secureStore when available).
  hmacKey?: string;
  // OS keychain-backed cipher for the persisted key. Defaults to Electron
  // safeStorage when running under Electron; null disables encryption (the key
  // is then stored as plaintext 0600, used as a fallback only).
  secureStore?: SecureStore | null;
}

// Lazily resolve Electron safeStorage without importing electron at module load
// (keeps the module unit-testable outside an Electron process).
const resolveSecureStore = async (deps: AuditDeps): Promise<SecureStore | null> => {
  if (deps.secureStore !== undefined) return deps.secureStore;
  try {
    const mod = await import('electron');
    const ss = (mod as { safeStorage?: SecureStore })?.safeStorage;
    if (ss && typeof ss.isEncryptionAvailable === 'function' && ss.isEncryptionAvailable()) {
      return ss;
    }
  } catch {
    // electron unavailable (tests / non-Electron context)
  }
  return null;
};

const AUDIT_LEGACY_FILENAME = 'audit-log.json';
const AUDIT_FILENAME = 'audit-log.jsonl';
const AUDIT_KEY_FILENAME = 'audit-key';

const isAuditEntry = (value: unknown): value is AuditEntry => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.action === 'string';
};

let idCounter = 0;
const generateId = (): string => `audit-${Date.now()}-${++idCounter}`;

// Keyed HMAC-SHA256 over the entry and the previous signature. Without the key
// the signature cannot be recomputed, so editing the JSON file is detectable.
/**
 * A stable, non-reversible identifier for a signing key.
 *
 * An HMAC of a fixed label under the key, truncated to 16 hex characters. The
 * label is constant so the same key always yields the same id, and the HMAC is
 * one-way so an id on disk reveals nothing about the key that produced it.
 */
const KEY_ID_LABEL = 'yosemite-audit-key-id/v1';

export const computeKeyId = (key: string): string =>
  crypto.createHmac('sha256', key).update(KEY_ID_LABEL).digest('hex').slice(0, 16);

const computeSignature = (entry: Omit<AuditEntry, 'signature'>, key: string): string => {
  const payload = `${entry.id}|${entry.timestamp}|${entry.action}|${entry.actor}|${entry.resourceType}|${entry.resourceId}|${JSON.stringify(entry.details)}|${entry.prevSignature}`;
  /* keyId joins the signed payload only when present, so an entry written
     before this field existed hashes to exactly what it did then and still
     verifies. A new entry covers it, so the provenance cannot be edited to
     disguise a foreign key as the current one. */
  const withProvenance = entry.keyId ? `${payload}|${entry.keyId}` : payload;
  return crypto.createHmac('sha256', key).update(withProvenance).digest('hex');
};

export const createAuditLog = async (dirPath: string, deps: AuditDeps = {}): Promise<AuditLog> => {
  const readFileSync = deps.readFileSync || fs.readFileSync;
  const writeFileSync = deps.writeFileSync || fs.writeFileSync;
  const mkdirSync = deps.mkdirSync || fs.mkdirSync;
  const existsSync = deps.existsSync || fs.existsSync;
  const now = deps.now || (() => Date.now());
  // The signing key was the one compliance path still built with a bare join,
  // so it never went through the containment check every other path in these
  // stores uses. It reads a secret, which makes it the worst one to leave out.
  const keyPath = containedPath(dirPath, AUDIT_KEY_FILENAME);

  const secureStore = await resolveSecureStore(deps);

  /**
   * Reading the stored key has three outcomes, and conflating the last two is
   * what destroys an installation's audit history: "there is no key yet" means
   * mint one, but "the key is there and cannot be read right now" (no keyring
   * session, locked or reset login keychain) must never be answered by writing a
   * new key over it.
   */
  type KeyRead =
    | { status: 'found'; key: string }
    | { status: 'absent' }
    | { status: 'unreadable'; reason: string };

  const isLegacyHexKey = (stored: string): boolean => /^[0-9a-f]{32,}$/i.test(stored);

  const decodeStoredKey = (stored: string): KeyRead => {
    let parsed: { enc?: boolean; data?: string; key?: string } | null = null;
    try {
      const value: unknown = JSON.parse(stored);
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        parsed = value as { enc?: boolean; data?: string; key?: string };
      }
    } catch {
      // not JSON: may be a legacy plaintext-hex key file
    }

    if (parsed === null) {
      if (isLegacyHexKey(stored)) return { status: 'found', key: stored };
      return { status: 'unreadable', reason: 'the key file is not in a recognised format' };
    }

    if (parsed.enc) {
      if (!parsed.data) {
        return { status: 'unreadable', reason: 'the encrypted key file contains no key data' };
      }
      if (!secureStore) {
        return {
          status: 'unreadable',
          reason: 'the key is encrypted but the OS keychain is unavailable',
        };
      }
      try {
        return {
          status: 'found',
          key: secureStore.decryptString(Buffer.from(parsed.data, 'base64')),
        };
      } catch (error) {
        return {
          status: 'unreadable',
          reason: `the OS keychain could not decrypt the key: ${(error as Error).message}`,
        };
      }
    }

    if (typeof parsed.key === 'string' && parsed.key !== '') {
      return { status: 'found', key: parsed.key };
    }
    return { status: 'unreadable', reason: 'the key file contains no usable key' };
  };

  const readExistingKey = (): KeyRead => {
    if (!existsSync(keyPath)) return { status: 'absent' };
    let stored: string;
    try {
      stored = String(readFileSync(keyPath, 'utf8')).trim();
    } catch (error) {
      return {
        status: 'unreadable',
        reason: `the key file could not be read: ${(error as Error).message}`,
      };
    }
    if (stored === '') return { status: 'unreadable', reason: 'the key file is empty' };
    return decodeStoredKey(stored);
  };

  interface KeyState {
    key: string;
    persisted: boolean;
    reason: string | null;
  }

  const loadOrCreateKey = (): KeyState => {
    const existing = readExistingKey();
    if (existing.status === 'found') return { key: existing.key, persisted: true, reason: null };

    const key = crypto.randomBytes(32).toString('hex');
    if (existing.status === 'unreadable') {
      // Overwriting here would destroy the only means of ever verifying the
      // existing history, permanently, in response to a condition that is
      // usually temporary. Run on a session key and leave the stored one intact
      // so it still works once the keychain is available again.
      return { key, persisted: false, reason: existing.reason };
    }

    try {
      mkdirSync(dirPath, { recursive: true });
      const wrapper = secureStore
        ? { enc: true, data: secureStore.encryptString(key).toString('base64') }
        : { enc: false, key };
      writeFileSync(keyPath, JSON.stringify(wrapper), { mode: 0o600 });
      return { key, persisted: true, reason: null };
    } catch (error) {
      return {
        key,
        persisted: false,
        reason: `the new signing key could not be saved: ${(error as Error).message}`,
      };
    }
  };

  const keyState: KeyState = deps.hmacKey
    ? { key: deps.hmacKey, persisted: true, reason: null }
    : loadOrCreateKey();
  const key = keyState.key;

  const store = createJsonlStore<AuditEntry>({
    dirPath,
    fileName: AUDIT_FILENAME,
    legacyFileName: AUDIT_LEGACY_FILENAME,
    isRecord: isAuditEntry,
    watermarkOf: (entry) => entry.signature,
    fsq: deps,
    now,
  });

  const currentKeyId = computeKeyId(key);

  const load = (): AuditEntry[] => store.readAll();

  const append = (
    input: Omit<AuditEntry, 'id' | 'timestamp' | 'signature' | 'prevSignature'>
  ): AuditEntry => {
    const entries = load();
    const prevSignature = entries.length > 0 ? entries[entries.length - 1]!.signature : '';
    const unsigned: Omit<AuditEntry, 'signature'> = {
      ...input,
      id: generateId(),
      timestamp: now(),
      prevSignature,
      // Stamped from the key actually in hand, whether or not it is the stored
      // one. That is the whole point: a temporary key must leave a trace.
      keyId: currentKeyId,
    };
    const entry: AuditEntry = {
      ...unsigned,
      signature: computeSignature(unsigned, key),
    };
    try {
      // The store only advances its in-memory view once the bytes are durable,
      // so a failed write cannot leave the session showing a signed entry that
      // is on no disk anywhere.
      store.append(entry);
    } catch (error) {
      throw new AuditWriteError(
        `failed to persist audit entry ${entry.id}: ${(error as Error).message}`,
        error
      );
    }
    return entry;
  };

  const query = (opts?: {
    resourceType?: string;
    resourceId?: string;
    since?: number;
    limit?: number;
  }): AuditEntry[] => {
    let entries = [...load()];
    if (opts?.resourceType) {
      entries = entries.filter((e) => e.resourceType === opts.resourceType);
    }
    if (opts?.resourceId) {
      entries = entries.filter((e) => e.resourceId === opts.resourceId);
    }
    if (opts?.since) {
      entries = entries.filter((e) => e.timestamp >= opts.since!);
    }
    entries.sort((a, b) => b.timestamp - a.timestamp);
    if (opts?.limit && opts.limit > 0) {
      entries = entries.slice(0, opts.limit);
    }
    return entries;
  };

  const getByResource = (resourceType: string, resourceId: string): AuditEntry[] =>
    query({ resourceType, resourceId });

  const getByActor = (actor: string): AuditEntry[] =>
    load()
      .filter((e) => e.actor === actor)
      .sort((a, b) => b.timestamp - a.timestamp);

  const getRange = (start: number, end: number): AuditEntry[] =>
    load()
      .filter((e) => e.timestamp >= start && e.timestamp <= end)
      .sort((a, b) => b.timestamp - a.timestamp);

  const size = (): number => load().length;

  /**
   * Whether this entry was signed by a key other than the one in hand.
   *
   * An entry with no keyId predates the field, so its key is unknown and it is
   * treated the same way: unverifiable, never "tampered".
   */
  const signedByAnotherKey = (entry: AuditEntry): boolean =>
    entry.keyId !== undefined && entry.keyId !== currentKeyId;

  const verify = (entry: AuditEntry): boolean => {
    const { signature, ...rest } = entry;
    const candidate = computeSignature(rest, key);
    if (candidate.length !== signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(signature));
  };

  /**
   * `otherKey` counts entries a different key signed - during a session where
   * the stored key was unreadable, for instance. They are NOT tampered, and
   * counting them as such is the false alarm this exists to prevent. They stay
   * out of `valid` too, because nothing here can vouch for them.
   */
  const verifyAll = (): { valid: number; tampered: number; otherKey: number } => {
    const entries = load();
    let valid = 0;
    let tampered = 0;
    let otherKey = 0;
    for (const entry of entries) {
      if (signedByAnotherKey(entry)) otherKey++;
      else if (verify(entry)) valid++;
      else tampered++;
    }
    return { valid, tampered, otherKey };
  };

  const verifyChain = (): boolean => {
    const entries = load();
    let prev = '';
    for (const entry of entries) {
      if (entry.prevSignature !== prev) return false;
      /* Deliberately NOT skipped for a foreign key. Skipping looks reasonable -
         the HMAC genuinely cannot be recomputed without that key - but it opens
         a hole: edit an entry's contents, overwrite its keyId with any other
         value, and it is excused from verification and the chain walks clean.
         A test drives exactly that. Without the old key an edit under it is
         undetectable, so the honest answer is that the chain cannot be attested,
         never that it is intact. `getIntegrity` explains why. */
      if (!verify(entry)) return false;
      prev = entry.signature;
    }

    // Walking the surviving entries proves they are internally consistent, not
    // that they are all of them. A log truncated back to its first entry walks
    // perfectly: prevSignature is '' and the HMAC is genuine. The watermark is
    // what makes that case distinguishable from a genuinely new install.
    if (!getIntegrity().ok) return false;
    const watermark = store.watermarkValue();
    if (watermark !== '' && !entries.some((e) => e.signature === watermark)) return false;
    return true;
  };

  const getIntegrity = (): AuditIntegrity => {
    const health = store.health();
    if (keyState.persisted) {
      /* Entries a different key signed are unverifiable here even though the
         stored key is readable again - a window where the keychain was down.
         Saying so is the point of #2553: the alternative was a permanent
         "Tampered" with no reason line, which reads as a breach. */
      const foreign = load().filter(signedByAnotherKey).length;
      if (foreign > 0) {
        const foreignReason =
          `${foreign} ${foreign === 1 ? 'entry was' : 'entries were'} signed with a different key, ` +
          `recorded while the stored signing key could not be read; their signatures cannot be ` +
          `re-checked and this is not evidence of tampering`;
        return {
          ...health,
          ok: false,
          reason: health.reason ? `${health.reason}; ${foreignReason}` : foreignReason,
          signingKey: 'persisted',
        };
      }
      return { ...health, signingKey: 'persisted' };
    }
    const keyReason =
      `the audit signing key could not be read (${keyState.reason}), so this session signs with a ` +
      `temporary key; earlier entries cannot be verified until the stored key is readable again`;
    return {
      ...health,
      ok: false,
      reason: health.reason ? `${health.reason}; ${keyReason}` : keyReason,
      signingKey: 'session-only',
    };
  };

  return {
    append,
    query,
    getByResource,
    getByActor,
    getRange,
    size,
    verify,
    verifyAll,
    verifyChain,
    getIntegrity,
  };
};

export type AuditLogFull = ReturnType<typeof createAuditLog>;
