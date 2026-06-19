"use strict";

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const CACHE_FILENAME = "offline-cache-v1.json";
export const MAX_ENTRIES = 500;
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_SIZE_BYTES = 100 * 1024 * 1024;

// Encrypted format: YCENC\x01<HMAC(32 bytes)><ciphertext>
const MAGIC_HEADER = Buffer.from("YCENC\x01", "utf8");
const MAGIC_SIZE = 6;
const INTEGRITY_SIZE = 32;
const HMAC_KEY = Buffer.from("yc-offline-cache-integrity-key", "utf8");

export interface CacheEntry {
  url: string;
  body: Buffer;
  contentType: string;
  statusCode: number;
  headers: Record<string, string>;
  cachedAt: number;
  byteLength: number;
  version?: number;
}

export interface CacheStats {
  entryCount: number;
  totalBytes: number;
  oldestEntry: number;
  newestEntry: number;
}

export interface OfflineCache {
  get(url: string): CacheEntry | undefined;
  set(entry: CacheEntry): void;
  delete(url: string): boolean;
  clear(): void;
  clearExpired(): number;
  has(url: string): boolean;
  getStats(): CacheStats;
  entries(): CacheEntry[];
  urls(): string[];
  flush(): Promise<void>;
}

export interface StoreDeps {
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  existsSync?: typeof fs.existsSync;
  now?: () => number;
  encryptString?: (plain: string) => Buffer;
  decryptString?: (encrypted: Buffer) => string;
  logger?: { warn: (msg: string, data?: Record<string, unknown>) => void };
  maxEntries?: number;
  maxSizeBytes?: number;
}

const bufferReviver = (_key: string, value: unknown): unknown => {
  if (
    value &&
    typeof value === "object" &&
    (value as Record<string, unknown>).type === "Buffer" &&
    Array.isArray((value as Record<string, unknown>).data)
  ) {
    return Buffer.from((value as Record<string, unknown>).data as number[]);
  }
  return value;
};

const detectOldBase64Body = (body: unknown): Buffer | null => {
  if (typeof body !== "string") return null;
  try {
    return Buffer.from(body, "base64");
  } catch {
    return null;
  }
};

const OLD_MAGIC_HEADER = Buffer.from("YCENC", "utf8");
const OLD_MAGIC_SIZE = 5;

const detectHeader = (
  raw: Buffer,
): { encryptedOffset: number; isEncrypted: boolean } => {
  if (raw.subarray(0, MAGIC_SIZE).equals(MAGIC_HEADER)) {
    return { encryptedOffset: MAGIC_SIZE + INTEGRITY_SIZE, isEncrypted: true };
  }
  if (raw.subarray(0, OLD_MAGIC_SIZE).equals(OLD_MAGIC_HEADER)) {
    return {
      encryptedOffset: OLD_MAGIC_SIZE + INTEGRITY_SIZE,
      isEncrypted: true,
    };
  }
  return { encryptedOffset: 0, isEncrypted: false };
};

// The 6-byte v1 magic ("YCENC\x01") shares its first five bytes with the legacy
// 5-byte magic ("YCENC"), so a legacy file whose first integrity byte is 0x01 is
// indistinguishable from a v1 header by prefix alone. Try every header length
// whose magic matches and accept the first whose HMAC verifies, so that
// ~1-in-256 collision can't silently drop an otherwise valid cache.
const decryptVerified = (
  raw: Buffer,
  decryptString: (encrypted: Buffer) => string,
): string | null => {
  const headerSizes: number[] = [];
  if (raw.subarray(0, MAGIC_SIZE).equals(MAGIC_HEADER))
    headerSizes.push(MAGIC_SIZE);
  if (raw.subarray(0, OLD_MAGIC_SIZE).equals(OLD_MAGIC_HEADER))
    headerSizes.push(OLD_MAGIC_SIZE);
  for (const headerSize of headerSizes) {
    const encrypted = raw.subarray(headerSize + INTEGRITY_SIZE);
    const storedHash = raw.subarray(headerSize, headerSize + INTEGRITY_SIZE);
    const computedHash = crypto
      .createHmac("sha256", HMAC_KEY)
      .update(encrypted)
      .digest();
    if (storedHash.equals(computedHash)) return decryptString(encrypted);
  }
  return null;
};

const loadEntries = (
  filePath: string,
  readFileSync: typeof fs.readFileSync,
  decryptString?: (encrypted: Buffer) => string,
  existsSync?: typeof fs.existsSync,
): CacheEntry[] => {
  try {
    if (existsSync && !existsSync(filePath)) return [];
    const raw = readFileSync(filePath) as Buffer;
    let jsonStr: string;

    const { isEncrypted } = detectHeader(raw);
    if (isEncrypted && decryptString) {
      const decrypted = decryptVerified(raw, decryptString);
      if (decrypted === null) return [];
      jsonStr = decrypted;
    } else if (isEncrypted && !decryptString) {
      return [];
    } else {
      jsonStr = raw.toString("utf8");
    }

    const data: unknown = JSON.parse(jsonStr, bufferReviver);
    if (!Array.isArray(data)) return [];
    return data.filter((e: unknown): e is CacheEntry => {
      if (typeof e !== "object" || e === null) return false;
      const entry = e as Record<string, unknown>;
      if (typeof entry.url !== "string") return false;
      if (typeof entry.cachedAt !== "number") return false;
      if (entry.body === undefined || entry.body === null) return false;
      if (typeof entry.body === "string") {
        const decoded = detectOldBase64Body(entry.body);
        if (!decoded) return false;
        entry.body = decoded;
        entry.byteLength = decoded.length;
        return true;
      }
      return Buffer.isBuffer(entry.body);
    });
  } catch {
    return [];
  }
};

const persistEntries = (
  filePath: string,
  entries: CacheEntry[],
  writeFileSync: typeof fs.writeFileSync,
  mkdirSync: typeof fs.mkdirSync,
  encryptString?: (plain: string) => Buffer,
): { ok: true } | { ok: false; error: string } => {
  try {
    mkdirSync(path.dirname(filePath), { recursive: true });
    const jsonStr = JSON.stringify(entries);
    if (encryptString) {
      const encrypted = encryptString(jsonStr);
      const integrityHash = crypto
        .createHmac("sha256", HMAC_KEY)
        .update(encrypted)
        .digest();
      writeFileSync(
        filePath,
        Buffer.concat([MAGIC_HEADER, integrityHash, encrypted]),
      );
    } else {
      writeFileSync(filePath, jsonStr, "utf8");
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
};

export const createOfflineCache = (
  dirPath: string,
  deps: StoreDeps = {},
): OfflineCache => {
  const readFileSync = deps.readFileSync || fs.readFileSync;
  const writeFileSync = deps.writeFileSync || fs.writeFileSync;
  const mkdirSync = deps.mkdirSync || fs.mkdirSync;
  const existsSync = deps.existsSync;
  const now = deps.now || (() => Date.now());
  const encryptString = deps.encryptString;
  const decryptString = deps.decryptString;
  const logger = deps.logger;
  const maxEntries = deps.maxEntries ?? MAX_ENTRIES;
  const maxSizeBytes = deps.maxSizeBytes ?? MAX_SIZE_BYTES;
  const filePath = path.join(dirPath, CACHE_FILENAME);

  let cached: CacheEntry[] = [];
  let urlIndex = new Map<string, number>();
  let loaded = false;
  let writePending = false;
  let writeResolve: (() => void) | null = null;

  const rebuildIndex = (): void => {
    urlIndex = new Map();
    for (let i = 0; i < cached.length; i++) {
      const entry = cached[i];
      if (entry) urlIndex.set(entry.url, i);
    }
  };

  const load = (): CacheEntry[] => {
    if (loaded) return cached;
    loaded = true;
    if (!encryptString) {
      if (logger)
        logger.warn("offline_cache_skipped", { reason: "no-encryption" });
      cached = [];
      urlIndex.clear();
      return cached;
    }
    cached = loadEntries(filePath, readFileSync, decryptString, existsSync);
    rebuildIndex();
    return cached;
  };

  const persist = (entries: CacheEntry[]): void => {
    if (!encryptString) return;
    const result = persistEntries(
      filePath,
      entries,
      writeFileSync,
      mkdirSync,
      encryptString,
    );
    if (!result.ok) {
      logger?.warn("offline_cache_write_failed", { error: result.error });
    }
  };

  const settleFlush = (resolve: () => void): void => {
    if (writePending) {
      writeResolve = (): void => {
        writeResolve = null;
        resolve();
      };
      return;
    }
    resolve();
  };

  const flush = async (): Promise<void> => {
    if (!writePending) return;
    // Write is sync so pending should resolve immediately; if somehow still
    // pending (e.g. async file system in tests), wait for next microtask.
    await new Promise<void>((resolve) =>
      setImmediate(() => settleFlush(resolve)),
    );
  };

  const markWritten = (): void => {
    writePending = false;
    if (writeResolve) {
      writeResolve();
      writeResolve = null;
    }
  };

  const applyEviction = (entries: CacheEntry[]): CacheEntry[] => {
    if (entries.length > maxEntries) {
      entries.sort((a, b) => b.cachedAt - a.cachedAt);
      entries = entries.slice(0, maxEntries);
    }
    let totalBytes = entries.reduce((sum, e) => sum + e.byteLength, 0);
    if (totalBytes > maxSizeBytes) {
      entries.sort((a, b) => b.cachedAt - a.cachedAt);
      while (totalBytes > maxSizeBytes && entries.length > 1) {
        const removed = entries.pop();
        if (removed) totalBytes -= removed.byteLength;
      }
    }
    return entries;
  };

  const get = (url: string): CacheEntry | undefined => {
    load();
    const idx = urlIndex.get(url);
    return idx === undefined ? undefined : cached[idx];
  };

  const set = (entry: CacheEntry): void => {
    load();
    const existingIdx = urlIndex.get(entry.url);
    if (existingIdx !== undefined) {
      cached.splice(existingIdx, 1);
    }
    cached.push(entry);
    cached = applyEviction(cached);
    rebuildIndex();
    writePending = true;
    persist(cached);
    markWritten();
  };

  const deleteEntry = (url: string): boolean => {
    load();
    const idx = urlIndex.get(url);
    if (idx === undefined) return false;
    cached.splice(idx, 1);
    rebuildIndex();
    writePending = true;
    persist(cached);
    markWritten();
    return true;
  };

  const clear = (): void => {
    load();
    cached = [];
    urlIndex.clear();
    writePending = true;
    persist(cached);
    markWritten();
  };

  const clearExpired = (): number => {
    load();
    const cutoff = now() - MAX_AGE_MS;
    const before = cached.length;
    const filtered = cached.filter((e) => e.cachedAt >= cutoff);
    const removed = before - filtered.length;
    if (removed > 0) {
      cached = filtered;
      rebuildIndex();
      writePending = true;
      persist(cached);
      markWritten();
    }
    return removed;
  };

  const has = (url: string): boolean => {
    load();
    return urlIndex.has(url);
  };

  const getStats = (): CacheStats => {
    load();
    if (cached.length === 0)
      return { entryCount: 0, totalBytes: 0, oldestEntry: 0, newestEntry: 0 };
    const timestamps = cached.map((e) => e.cachedAt);
    return {
      entryCount: cached.length,
      totalBytes: cached.reduce((sum, e) => sum + e.byteLength, 0),
      oldestEntry: Math.min(...timestamps),
      newestEntry: Math.max(...timestamps),
    };
  };

  const entries = (): CacheEntry[] => {
    load();
    return cached;
  };

  const urls = (): string[] => {
    load();
    return cached.map((e) => e.url);
  };

  return {
    get,
    set,
    delete: deleteEntry,
    clear,
    clearExpired,
    has,
    getStats,
    entries,
    urls,
    flush,
  };
};

export const createCacheEntry = (
  url: string,
  body: string | Buffer,
  contentType: string,
  statusCode: number = 200,
  headers: Record<string, string> = {},
  cachedAt: number = Date.now(),
): CacheEntry => {
  const buf = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  return {
    url,
    body: buf,
    contentType,
    statusCode,
    headers,
    cachedAt,
    byteLength: buf.length,
    version: 1,
  };
};

export const decodeCacheEntry = (
  entry: CacheEntry,
): {
  url: string;
  body: Buffer;
  contentType: string;
  statusCode: number;
  headers: Record<string, string>;
  cachedAt: number;
} => ({
  url: entry.url,
  body: entry.body,
  contentType: entry.contentType,
  statusCode: entry.statusCode,
  headers: entry.headers,
  cachedAt: entry.cachedAt,
});
