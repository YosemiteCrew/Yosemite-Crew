'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';

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
  verifyAll: () => { valid: number; tampered: number };
  // Verifies the full hash chain: each entry's stored prevSignature must match
  // the actual prior entry, catching deletion, insertion and reordering.
  verifyChain: () => boolean;
}

// OS-backed encryption (Electron safeStorage). Injectable for tests.
export interface SecureStore {
  isEncryptionAvailable: () => boolean;
  encryptString: (plain: string) => Buffer;
  decryptString: (encrypted: Buffer) => string;
}

interface AuditDeps {
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  existsSync?: typeof fs.existsSync;
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

const AUDIT_FILENAME = 'audit-log.json';
const AUDIT_KEY_FILENAME = 'audit-key';

let idCounter = 0;
const generateId = (): string => `audit-${Date.now()}-${++idCounter}`;

// Keyed HMAC-SHA256 over the entry and the previous signature. Without the key
// the signature cannot be recomputed, so editing the JSON file is detectable.
const computeSignature = (entry: Omit<AuditEntry, 'signature'>, key: string): string => {
  const payload = `${entry.id}|${entry.timestamp}|${entry.action}|${entry.actor}|${entry.resourceType}|${entry.resourceId}|${JSON.stringify(entry.details)}|${entry.prevSignature}`;
  return crypto.createHmac('sha256', key).update(payload).digest('hex');
};

export const createAuditLog = async (dirPath: string, deps: AuditDeps = {}): Promise<AuditLog> => {
  const readFileSync = deps.readFileSync || fs.readFileSync;
  const writeFileSync = deps.writeFileSync || fs.writeFileSync;
  const mkdirSync = deps.mkdirSync || fs.mkdirSync;
  const existsSync = deps.existsSync || fs.existsSync;
  const now = deps.now || (() => Date.now());
  const filePath = path.join(dirPath, AUDIT_FILENAME);
  const keyPath = path.join(dirPath, AUDIT_KEY_FILENAME);

  const secureStore = await resolveSecureStore(deps);

  // Parse a stored key file wrapper. Returns the recovered key, or null when the
  // wrapper is present but unusable (caller then generates a fresh key).
  const decodeStoredKey = (stored: string): string | null => {
    try {
      const parsed = JSON.parse(stored) as {
        enc?: boolean;
        data?: string;
        key?: string;
      };
      if (parsed.enc && parsed.data && secureStore) {
        return secureStore.decryptString(Buffer.from(parsed.data, 'base64'));
      }
      if (!parsed.enc && typeof parsed.key === 'string') return parsed.key;
      return null;
    } catch {
      // legacy plaintext-hex key file
      return stored;
    }
  };

  const readExistingKey = (): string | null => {
    try {
      if (!existsSync(keyPath)) return null;
      const stored = readFileSync(keyPath, 'utf8').trim();
      return stored ? decodeStoredKey(stored) : null;
    } catch {
      // fall through and create a new key
      return null;
    }
  };

  const loadOrCreateKey = (): string => {
    const existing = readExistingKey();
    if (existing !== null) return existing;
    const key = crypto.randomBytes(32).toString('hex');
    try {
      mkdirSync(dirPath, { recursive: true });
      const wrapper = secureStore
        ? { enc: true, data: secureStore.encryptString(key).toString('base64') }
        : { enc: false, key };
      writeFileSync(keyPath, JSON.stringify(wrapper), { mode: 0o600 });
    } catch {
      // if persistence fails the key still works for this session
    }
    return key;
  };

  const key = deps.hmacKey || loadOrCreateKey();

  let cached: AuditEntry[] | null = null;

  const load = (): AuditEntry[] => {
    if (cached) return cached;
    try {
      if (!existsSync(filePath)) {
        cached = [];
        return cached;
      }
      const raw = readFileSync(filePath, 'utf8');
      const entries: AuditEntry[] = JSON.parse(raw);
      if (!Array.isArray(entries)) {
        cached = [];
        return cached;
      }
      cached = entries.filter((e) => typeof e.id === 'string' && typeof e.action === 'string');
      return cached;
    } catch {
      cached = [];
      return cached;
    }
  };

  const save = (entries: AuditEntry[]): void => {
    cached = entries;
    try {
      mkdirSync(dirPath, { recursive: true });
      writeFileSync(filePath, JSON.stringify(entries), 'utf8');
    } catch {
      // persist must never break the app
    }
  };

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
    };
    const entry: AuditEntry = {
      ...unsigned,
      signature: computeSignature(unsigned, key),
    };
    entries.push(entry);
    save(entries);
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

  const verify = (entry: AuditEntry): boolean => {
    const { signature, ...rest } = entry;
    const candidate = computeSignature(rest, key);
    if (candidate.length !== signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(signature));
  };

  const verifyAll = (): { valid: number; tampered: number } => {
    const entries = load();
    let valid = 0;
    let tampered = 0;
    for (const entry of entries) {
      if (verify(entry)) valid++;
      else tampered++;
    }
    return { valid, tampered };
  };

  const verifyChain = (): boolean => {
    const entries = load();
    let prev = '';
    for (const entry of entries) {
      if (entry.prevSignature !== prev) return false;
      if (!verify(entry)) return false;
      prev = entry.signature;
    }
    return true;
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
  };
};

export type AuditLogFull = ReturnType<typeof createAuditLog>;
