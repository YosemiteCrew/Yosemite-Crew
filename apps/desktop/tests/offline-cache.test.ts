import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  createOfflineCache,
  createCacheEntry,
  decodeCacheEntry,
  MAX_ENTRIES,
} from '../src/sync/offline-cache';
import crypto from 'node:crypto';

const testDirs: string[] = [];

afterAll(() => {
  testDirs.forEach((d) => {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });
});

const freshDir = (): string => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-cache-test-'));
  testDirs.push(d);
  return d;
};

const makeEntry = (url: string, body: string = 'hello', contentType: string = 'text/html') =>
  createCacheEntry(url, body, contentType);

describe('createOfflineCache', () => {
  test('get returns undefined for missing URL', () => {
    const cache = createOfflineCache(freshDir());
    expect(cache.get('https://example.com/not-cached')).toBeUndefined();
  });

  test('set and get round-trips a cache entry', () => {
    const cache = createOfflineCache(freshDir());
    cache.set(makeEntry('https://example.com/page1', 'content1'));
    const entry = cache.get('https://example.com/page1');
    expect(entry).toBeDefined();
    expect(entry!.url).toBe('https://example.com/page1');
  });

  test('set overwrites existing entry for same URL', () => {
    const cache = createOfflineCache(freshDir());
    cache.set(makeEntry('https://example.com/page', 'v1'));
    cache.set(makeEntry('https://example.com/page', 'v2'));
    expect(cache.entries()).toHaveLength(1);
  });

  test('has returns true for cached URL', () => {
    const cache = createOfflineCache(freshDir());
    cache.set(makeEntry('https://example.com/foo'));
    expect(cache.has('https://example.com/foo')).toBe(true);
    expect(cache.has('https://example.com/nope')).toBe(false);
  });

  test('delete removes entry and returns true', () => {
    const cache = createOfflineCache(freshDir());
    cache.set(makeEntry('https://example.com/del'));
    expect(cache.delete('https://example.com/del')).toBe(true);
    expect(cache.has('https://example.com/del')).toBe(false);
  });

  test('delete returns false for non-existent URL', () => {
    const cache = createOfflineCache(freshDir());
    expect(cache.delete('https://example.com/nope')).toBe(false);
  });

  test('clear removes all entries', () => {
    const cache = createOfflineCache(freshDir());
    cache.set(makeEntry('https://example.com/a'));
    cache.set(makeEntry('https://example.com/b'));
    cache.clear();
    expect(cache.entries()).toHaveLength(0);
    expect(cache.getStats().entryCount).toBe(0);
  });

  test('urls returns list of cached URLs', () => {
    const cache = createOfflineCache(freshDir());
    cache.set(makeEntry('https://example.com/1', 'a'));
    cache.set(makeEntry('https://example.com/2', 'b'));
    const urls = cache.urls();
    expect(urls).toContain('https://example.com/1');
    expect(urls).toContain('https://example.com/2');
    expect(urls).toHaveLength(2);
  });

  test('getStats returns correct stats', () => {
    const cache = createOfflineCache(freshDir());
    cache.set(makeEntry('https://example.com/1', 'a'));
    const stats = cache.getStats();
    expect(stats.entryCount).toBe(1);
    expect(stats.totalBytes).toBeGreaterThan(0);
    expect(stats.newestEntry).toBeGreaterThanOrEqual(stats.oldestEntry);
  });

  test('getStats returns zeros for empty cache', () => {
    const cache = createOfflineCache(freshDir());
    expect(cache.getStats()).toEqual({
      entryCount: 0,
      totalBytes: 0,
      oldestEntry: 0,
      newestEntry: 0,
    });
  });

  test('enforces MAX_ENTRIES limit evicting oldest', () => {
    const cache = createOfflineCache(freshDir());
    for (let i = 0; i < MAX_ENTRIES + 10; i++) {
      cache.set(makeEntry(`https://example.com/p${i}`, `body${i}`));
    }
    expect(cache.urls()).toHaveLength(MAX_ENTRIES);
  });

  test('evicts oldest entries when total size exceeds limit', () => {
    const cache = createOfflineCache(freshDir());
    const body = 'x'.repeat(1024 * 10);
    for (let i = 0; i < 10; i++) {
      cache.set(makeEntry(`https://example.com/${i}`, body));
    }
    const stats = cache.getStats();
    expect(stats.entryCount).toBeLessThanOrEqual(10);
    expect(stats.totalBytes).toBeGreaterThan(0);
  });

  test('clearExpired removes entries older than MAX_AGE_MS', () => {
    const dir = freshDir();
    const past = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const cache = createOfflineCache(dir);

    cache.set(makeEntry('https://example.com/fresh', 'fresh'));

    const staleEntry = createCacheEntry(
      'https://example.com/stale',
      'stale',
      'text/html',
      200,
      {},
      past
    );
    cache.set(staleEntry);

    const removed = cache.clearExpired();
    expect(removed).toBe(1);
    expect(cache.has('https://example.com/fresh')).toBe(true);
    expect(cache.has('https://example.com/stale')).toBe(false);
  });

  test('persists data to disk across instances', () => {
    const dir = freshDir();
    const encryptString = jest.fn((plain: string) => Buffer.from(`enc:${plain}`));
    const decryptString = jest.fn((buf: Buffer) => buf.toString('utf8').replace(/^enc:/, ''));

    const cache1 = createOfflineCache(dir, { encryptString, decryptString });
    cache1.set(makeEntry('https://example.com/persist', 'persisted'));

    const cache2 = createOfflineCache(dir, { encryptString, decryptString });
    expect(cache2.has('https://example.com/persist')).toBe(true);
  });

  test('handles corrupt file gracefully', () => {
    const dir = freshDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'offline-cache-v1.json'), '{invalid}', 'utf8');
    const cache = createOfflineCache(dir);
    expect(cache.entries()).toEqual([]);
  });

  test('encrypts cache file when encryptString provided', () => {
    const dir = freshDir();
    const encryptString = jest.fn((plain: string) => Buffer.from(`enc:${plain}`));
    const decryptString = jest.fn((buf: Buffer) => buf.toString('utf8').replace(/^enc:/, ''));

    const cache = createOfflineCache(dir, { encryptString, decryptString });
    cache.set(makeEntry('https://example.com/secret', 'phi-data'));

    const entry = cache.get('https://example.com/secret');
    expect(encryptString).toHaveBeenCalled();
    expect(entry).toBeDefined();
    expect(entry!.url).toBe('https://example.com/secret');
  });

  test('encrypted cache persists across instances', () => {
    const dir = freshDir();
    const encryptString = jest.fn((plain: string) => Buffer.from(`enc:${plain}`));
    const decryptString = jest.fn((buf: Buffer) => buf.toString('utf8').replace(/^enc:/, ''));

    const cache1 = createOfflineCache(dir, { encryptString, decryptString });
    cache1.set(makeEntry('https://example.com/persist', 'encrypted-content'));

    const cache2 = createOfflineCache(dir, { encryptString, decryptString });
    expect(cache2.has('https://example.com/persist')).toBe(true);
    expect(decryptString).toHaveBeenCalled();
  });

  test('encrypted cache file has magic header', () => {
    const dir = freshDir();
    const encryptString = jest.fn((plain: string) => Buffer.from(`enc:${plain}`));
    const decryptString = jest.fn((buf: Buffer) => buf.toString('utf8').replace(/^enc:/, ''));

    const cache = createOfflineCache(dir, { encryptString, decryptString });
    cache.set(makeEntry('https://example.com/magic'));

    const raw = fs.readFileSync(path.join(dir, 'offline-cache-v1.json'));
    expect(raw.slice(0, 6).toString('utf8')).toBe('YCENC\x01');
  });

  test('encrypted cache not readable without decryptString', () => {
    const dir = freshDir();
    const encryptString = jest.fn((plain: string) => Buffer.from(`enc:${plain}`));
    const decryptString = jest.fn((buf: Buffer) => buf.toString('utf8').replace(/^enc:/, ''));

    const cache1 = createOfflineCache(dir, { encryptString, decryptString });
    cache1.set(makeEntry('https://example.com/no-decrypt'));

    const cache2 = createOfflineCache(dir);
    expect(cache2.has('https://example.com/no-decrypt')).toBe(false);
    expect(cache2.entries()).toEqual([]);
  });

  test('get with zero-length body', () => {
    const cache = createOfflineCache(freshDir());
    cache.set(createCacheEntry('https://example.com/empty', '', 'text/html'));
    const entry = cache.get('https://example.com/empty');
    expect(entry).toBeDefined();
    expect(entry!.body.length).toBe(0);
  });

  test('set with single entry exceeding MAX_SIZE_BYTES stops eviction at 1', () => {
    const cache = createOfflineCache(freshDir(), { maxSizeBytes: 100 });
    cache.set(
      createCacheEntry('https://example.com/big', Buffer.alloc(150), 'application/octet-stream')
    );
    expect(cache.urls()).toHaveLength(1);
  });

  test('delete on already-evicted entry returns false', () => {
    const cache = createOfflineCache(freshDir(), { maxEntries: 2 });
    cache.set(createCacheEntry('https://example.com/a', 'a', 'text/html', 200, {}, 1000));
    cache.set(createCacheEntry('https://example.com/b', 'b', 'text/html', 200, {}, 2000));
    cache.set(createCacheEntry('https://example.com/c', 'c', 'text/html', 200, {}, 3000));
    expect(cache.delete('https://example.com/a')).toBe(false);
  });

  test('clearExpired when all entries expired', () => {
    const now = Date.now();
    const farPast = now - 14 * 24 * 60 * 60 * 1000;
    const cache = createOfflineCache(freshDir(), { now: () => now });
    cache.set(createCacheEntry('https://example.com/old1', 'a', 'text/html', 200, {}, farPast));
    cache.set(createCacheEntry('https://example.com/old2', 'b', 'text/html', 200, {}, farPast));
    expect(cache.clearExpired()).toBe(2);
    expect(cache.entries()).toHaveLength(0);
  });

  test('clearExpired on empty cache', () => {
    const cache = createOfflineCache(freshDir());
    expect(cache.clearExpired()).toBe(0);
  });

  test('clearExpired when nothing expired', () => {
    const now = Date.now();
    const cache = createOfflineCache(freshDir(), { now: () => now });
    cache.set(makeEntry('https://example.com/fresh1', 'a'));
    cache.set(makeEntry('https://example.com/fresh2', 'b'));
    expect(cache.clearExpired()).toBe(0);
    expect(cache.entries()).toHaveLength(2);
  });

  test('encrypted file with corrupt payload returns empty', () => {
    const dir = freshDir();
    fs.mkdirSync(dir, { recursive: true });
    const magic = Buffer.from('YCENC\x01', 'utf8');
    const hash = Buffer.alloc(32, 0xff);
    const garbage = Buffer.from('this is not encrypted data', 'utf8');
    fs.writeFileSync(
      path.join(dir, 'offline-cache-v1.json'),
      Buffer.concat([magic, hash, garbage])
    );

    const decryptString = jest.fn((buf: Buffer) => buf.toString('utf8'));
    const cache = createOfflineCache(dir, { decryptString });
    expect(cache.entries()).toEqual([]);
  });

  test('encrypted file with magic header only returns empty', () => {
    const dir = freshDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'offline-cache-v1.json'),
      Buffer.concat([Buffer.from('YCENC\x01', 'utf8'), Buffer.alloc(32)])
    );

    const decryptString = jest.fn(() => '{}');
    const cache = createOfflineCache(dir, { decryptString });
    expect(cache.entries()).toEqual([]);
  });

  test('encryptString returning empty Buffer still creates file', () => {
    const dir = freshDir();
    const encryptString = jest.fn(() => Buffer.alloc(0));
    const decryptString = jest.fn(() => '[]');

    const cache = createOfflineCache(dir, { encryptString, decryptString });
    cache.set(makeEntry('https://example.com/test', 'data'));

    const raw = fs.readFileSync(path.join(dir, 'offline-cache-v1.json'));
    expect(raw.slice(0, 6).toString('utf8')).toBe('YCENC\x01');
  });

  test('decryptString returning invalid JSON returns empty', () => {
    const dir = freshDir();
    const encryptString = jest.fn((plain: string) => Buffer.from(`enc:${plain}`));
    const decryptString = jest.fn(() => '{invalid');
    const cache1 = createOfflineCache(dir, { encryptString, decryptString });
    cache1.set(makeEntry('https://example.com/bad', 'data'));

    const cache2 = createOfflineCache(dir, { encryptString, decryptString });
    expect(cache2.entries()).toEqual([]);
  });

  test('write failure during save does not crash and keeps in-memory state', () => {
    const dir = freshDir();
    const writeFileSync = jest.fn(() => {
      throw new Error('ENOSPC');
    });
    const cache = createOfflineCache(dir, {
      writeFileSync,
      mkdirSync: fs.mkdirSync,
      now: () => Date.now(),
    });
    cache.set(makeEntry('https://example.com/persist', 'data'));
    expect(cache.get('https://example.com/persist')).toBeDefined();
  });

  test('corrupt file valid JSON not array returns empty', () => {
    const dir = freshDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'offline-cache-v1.json'),
      JSON.stringify({ key: 'val' }),
      'utf8'
    );
    const cache = createOfflineCache(dir);
    expect(cache.entries()).toEqual([]);
  });

  test('corrupt file with malformed entries filters them out', () => {
    const dir = freshDir();
    const encryptString = jest.fn((plain: string) => Buffer.from(`enc:${plain}`));
    const decryptString = jest.fn((buf: Buffer) => buf.toString('utf8').replace(/^enc:/, ''));
    fs.mkdirSync(dir, { recursive: true });
    const valid = createCacheEntry('https://example.com/valid', 'ok', 'text/html');
    const bad = { url: 'https://example.com/bad' };
    fs.writeFileSync(path.join(dir, 'offline-cache-v1.json'), JSON.stringify([valid, bad]), 'utf8');
    const cache = createOfflineCache(dir, { encryptString, decryptString });
    const entries = cache.entries();
    expect(entries).toHaveLength(1);
    expect(entries[0].url).toBe('https://example.com/valid');
  });

  test('multiple set calls on different URLs both persist across instances', () => {
    const dir = freshDir();
    const encryptString = jest.fn((plain: string) => Buffer.from(`enc:${plain}`));
    const decryptString = jest.fn((buf: Buffer) => buf.toString('utf8').replace(/^enc:/, ''));

    const cache1 = createOfflineCache(dir, { encryptString, decryptString });
    cache1.set(makeEntry('https://example.com/a', 'a'));
    cache1.set(makeEntry('https://example.com/b', 'b'));

    const cache2 = createOfflineCache(dir, { encryptString, decryptString });
    expect(cache2.has('https://example.com/a')).toBe(true);
    expect(cache2.has('https://example.com/b')).toBe(true);
  });

  test('MAX_ENTRIES boundary evicts oldest when exceeding limit', () => {
    const cache = createOfflineCache(freshDir(), { maxEntries: 3 });
    cache.set(createCacheEntry('https://example.com/1', 'a', 'text/html', 200, {}, 1000));
    cache.set(createCacheEntry('https://example.com/2', 'b', 'text/html', 200, {}, 2000));
    cache.set(createCacheEntry('https://example.com/3', 'c', 'text/html', 200, {}, 3000));
    cache.set(createCacheEntry('https://example.com/4', 'd', 'text/html', 200, {}, 4000));
    expect(cache.urls()).toHaveLength(3);
    expect(cache.has('https://example.com/1')).toBe(false);
    expect(cache.has('https://example.com/4')).toBe(true);
  });

  test('MAX_SIZE_BYTES boundary evicts until under limit', () => {
    const cache = createOfflineCache(freshDir(), { maxSizeBytes: 50 });
    cache.set(createCacheEntry('https://example.com/1', Buffer.alloc(30), 'text/html'));
    cache.set(createCacheEntry('https://example.com/2', Buffer.alloc(30), 'text/html'));
    const stats = cache.getStats();
    expect(stats.totalBytes).toBeLessThanOrEqual(50);
    expect(stats.entryCount).toBe(1);
  });

  test('old format detection migrates base64 body on load', () => {
    const dir = freshDir();
    const encryptString = jest.fn((plain: string) => Buffer.from(`enc:${plain}`));
    const decryptString = jest.fn((buf: Buffer) => buf.toString('utf8').replace(/^enc:/, ''));
    fs.mkdirSync(dir, { recursive: true });
    const entry = createCacheEntry('https://example.com/migrate', 'original content', 'text/html');
    const raw = JSON.parse(JSON.stringify(entry));
    raw.body = Buffer.from(raw.body.data as number[]).toString('base64');
    fs.writeFileSync(path.join(dir, 'offline-cache-v1.json'), JSON.stringify([raw]), 'utf8');

    const cache = createOfflineCache(dir, { encryptString, decryptString });
    const loaded = cache.get('https://example.com/migrate');
    expect(loaded).toBeDefined();
    expect(loaded!.body.toString('utf8')).toBe('original content');
  });

  test('old 5-byte magic header is detected', () => {
    const dir = freshDir();
    fs.mkdirSync(dir, { recursive: true });
    const encryptString = jest.fn((plain: string) => Buffer.from(`enc:${plain}`));
    const decryptString = jest.fn((buf: Buffer) => buf.toString('utf8').replace(/^enc:/, ''));
    const HMAC_KEY = Buffer.from('yc-offline-cache-integrity-key', 'utf8');
    const oldMagic = Buffer.from('YCENC', 'utf8');
    const plaintext = JSON.stringify([
      createCacheEntry('https://example.com/old', 'data', 'text/html'),
    ]);
    const encrypted = encryptString(plaintext);
    const hash = crypto.createHmac('sha256', HMAC_KEY).update(encrypted).digest();
    fs.writeFileSync(
      path.join(dir, 'offline-cache-v1.json'),
      Buffer.concat([oldMagic, hash, encrypted])
    );

    const cache = createOfflineCache(dir, { encryptString, decryptString });
    expect(cache.has('https://example.com/old')).toBe(true);
  });

  test('legacy 5-byte magic whose first HMAC byte is 0x01 still loads', () => {
    const dir = freshDir();
    fs.mkdirSync(dir, { recursive: true });
    const encryptString = (plain: string) => Buffer.from(`enc:${plain}`);
    const decryptString = (buf: Buffer) => buf.toString('utf8').replace(/^enc:/, '');
    const HMAC_KEY = Buffer.from('yc-offline-cache-integrity-key', 'utf8');
    const oldMagic = Buffer.from('YCENC', 'utf8');

    // Deterministically construct the worst-case collision: a legacy file whose
    // first integrity byte is 0x01, so its first six bytes equal the v1 magic
    // "YCENC\x01". The loader must still recover it via the legacy header.
    let encrypted: Buffer | null = null;
    let hash: Buffer | null = null;
    let matchedUrl = '';
    for (let i = 0; i < 20000 && hash === null; i++) {
      const url = `https://example.com/legacy-${i}`;
      const enc = encryptString(JSON.stringify([createCacheEntry(url, 'data', 'text/html')]));
      const h = crypto.createHmac('sha256', HMAC_KEY).update(enc).digest();
      if (h[0] === 0x01) {
        encrypted = enc;
        hash = h;
        matchedUrl = url;
      }
    }
    expect(hash).not.toBeNull();

    fs.writeFileSync(
      path.join(dir, 'offline-cache-v1.json'),
      Buffer.concat([oldMagic, hash as Buffer, encrypted as Buffer])
    );

    const cache = createOfflineCache(dir, { encryptString, decryptString });
    expect(cache.has(matchedUrl)).toBe(true);
  });

  test('get with special characters in URL', () => {
    const cache = createOfflineCache(freshDir());
    const urls = [
      'https://example.com/path?query=1&key=val',
      'https://example.com/path#section',
      'https://example.com/path/üñîçødé',
      'https://example.com/path/with spaces',
    ];
    urls.forEach((url) => cache.set(makeEntry(url, url)));
    urls.forEach((url) => {
      expect(cache.get(url)).toBeDefined();
      expect(cache.get(url)!.url).toBe(url);
      expect(cache.has(url)).toBe(true);
    });
  });

  test('persistEntries catch block on write failure with encryptString', () => {
    const dir = freshDir();
    const writeFileSync = jest.fn(() => {
      throw new Error('ENOSPC');
    });
    const encryptString = jest.fn((plain: string) => Buffer.from(`enc:${plain}`));
    const decryptString = jest.fn((buf: Buffer) => buf.toString('utf8').replace(/^enc:/, ''));

    const cache = createOfflineCache(dir, {
      writeFileSync,
      encryptString,
      decryptString,
      now: () => Date.now(),
    });
    cache.set(makeEntry('https://example.com/fail', 'data'));
    expect(cache.get('https://example.com/fail')).toBeDefined();
  });

  test('load filters out entries with non-object body', () => {
    const dir = freshDir();
    fs.mkdirSync(dir, { recursive: true });
    const encryptString = jest.fn((plain: string) => Buffer.from(`enc:${plain}`));
    const decryptString = jest.fn((buf: Buffer) => buf.toString('utf8').replace(/^enc:/, ''));
    const valid = createCacheEntry('https://example.com/valid', 'ok', 'text/html');
    const nullBody = {
      ...valid,
      url: 'https://example.com/null-body',
      body: null,
    };
    const numBody = { ...valid, url: 'https://example.com/num-body', body: 42 };
    const strBody = {
      ...valid,
      url: 'https://example.com/str-body',
      body: 'aGVsbG8=',
    };
    fs.writeFileSync(
      path.join(dir, 'offline-cache-v1.json'),
      JSON.stringify([valid, nullBody, numBody, strBody]),
      'utf8'
    );
    const cache = createOfflineCache(dir, { encryptString, decryptString });
    const entries = cache.entries();
    expect(entries).toHaveLength(2);
    expect(entries[0].url).toBe('https://example.com/valid');
    expect(entries[1].url).toBe('https://example.com/str-body');
  });

  test('load filters out entries with non-string url', () => {
    const dir = freshDir();
    fs.mkdirSync(dir, { recursive: true });
    const encryptString = jest.fn((plain: string) => Buffer.from(`enc:${plain}`));
    const decryptString = jest.fn((buf: Buffer) => buf.toString('utf8').replace(/^enc:/, ''));
    const valid = createCacheEntry('https://example.com/valid', 'ok', 'text/html');
    const badUrl = {
      ...createCacheEntry('https://example.com/ignored', 'x', 'text/html'),
      url: 42,
      body: Buffer.from('x'),
    };
    const noUrl = {
      ...createCacheEntry('https://example.com/ignored2', 'x', 'text/html'),
      url: undefined,
      body: Buffer.from('x'),
    };
    fs.writeFileSync(
      path.join(dir, 'offline-cache-v1.json'),
      JSON.stringify([valid, badUrl, noUrl]),
      'utf8'
    );
    const cache = createOfflineCache(dir, { encryptString, decryptString });
    expect(cache.entries()).toHaveLength(1);
  });

  test('load filters out entries with missing cachedAt', () => {
    const dir = freshDir();
    fs.mkdirSync(dir, { recursive: true });
    const encryptString = jest.fn((plain: string) => Buffer.from(`enc:${plain}`));
    const decryptString = jest.fn((buf: Buffer) => buf.toString('utf8').replace(/^enc:/, ''));
    const valid = createCacheEntry('https://example.com/valid', 'ok', 'text/html');
    const missingCachedAt = {
      ...createCacheEntry('https://example.com/no-at', 'x', 'text/html'),
      cachedAt: undefined,
      body: Buffer.from('x'),
    };
    fs.writeFileSync(
      path.join(dir, 'offline-cache-v1.json'),
      JSON.stringify([valid, missingCachedAt]),
      'utf8'
    );
    const cache = createOfflineCache(dir, { encryptString, decryptString });
    expect(cache.entries()).toHaveLength(1);
  });

  test('load filters out non-object entries', () => {
    const dir = freshDir();
    fs.mkdirSync(dir, { recursive: true });
    const encryptString = jest.fn((plain: string) => Buffer.from(`enc:${plain}`));
    const decryptString = jest.fn((buf: Buffer) => buf.toString('utf8').replace(/^enc:/, ''));
    const valid = createCacheEntry('https://example.com/valid', 'ok', 'text/html');
    fs.writeFileSync(
      path.join(dir, 'offline-cache-v1.json'),
      JSON.stringify([valid, null, 'string', 42]),
      'utf8'
    );
    const cache = createOfflineCache(dir, { encryptString, decryptString });
    expect(cache.entries()).toHaveLength(1);
  });

  test('bufferReviver converts serialized Buffer in loaded cache', () => {
    const dir = freshDir();
    fs.mkdirSync(dir, { recursive: true });
    const encryptString = jest.fn((plain: string) => Buffer.from(`enc:${plain}`));
    const decryptString = jest.fn((buf: Buffer) => buf.toString('utf8').replace(/^enc:/, ''));
    const buf = Buffer.from('hello buffer');
    const entry = {
      ...createCacheEntry('https://example.com/buf', buf, 'text/plain'),
      byteLength: buf.length,
    };
    fs.writeFileSync(path.join(dir, 'offline-cache-v1.json'), JSON.stringify([entry]), 'utf8');
    const cache = createOfflineCache(dir, { encryptString, decryptString });
    const loaded = cache.get('https://example.com/buf');
    expect(loaded).toBeDefined();
    expect(Buffer.isBuffer(loaded!.body)).toBe(true);
    expect(loaded!.body.toString('utf8')).toBe('hello buffer');
  });

  test('flush resolves when writePending is false', async () => {
    const cache = createOfflineCache(freshDir());
    await expect(cache.flush()).resolves.toBeUndefined();
  });

  test('load with file not existing returns empty', () => {
    const cache = createOfflineCache(freshDir(), { existsSync: fs.existsSync });
    expect(cache.entries()).toEqual([]);
  });

  test('hmac integrity passes for correctly encrypted data', () => {
    const dir = freshDir();
    const encryptString = jest.fn((plain: string) => Buffer.from(`enc:${plain}`));
    const decryptString = jest.fn((buf: Buffer) => buf.toString('utf8').replace(/^enc:/, ''));
    const cache1 = createOfflineCache(dir, { encryptString, decryptString });
    cache1.set(makeEntry('https://example.com/hmac-check', 'data'));

    const cache2 = createOfflineCache(dir, { encryptString, decryptString });
    expect(cache2.has('https://example.com/hmac-check')).toBe(true);
  });
});

describe('createCacheEntry / decodeCacheEntry', () => {
  test('encode/decode round-trips body as Buffer', () => {
    const body = 'Hello, world! \u{1F600} special chars: \u00e9\u00f1';
    const entry = createCacheEntry('https://example.com/test', body, 'text/plain');
    const decoded = decodeCacheEntry(entry);
    expect(Buffer.isBuffer(decoded.body)).toBe(true);
    expect(decoded.body.toString('utf8')).toBe(body);
    expect(decoded.url).toBe('https://example.com/test');
    expect(decoded.contentType).toBe('text/plain');
    expect(decoded.statusCode).toBe(200);
  });

  test('createCacheEntry with Buffer body', () => {
    const buf = Buffer.from([0x00, 0x01, 0x02, 0xff]);
    const entry = createCacheEntry('https://example.com/binary', buf, 'application/octet-stream');
    expect(entry.body).toEqual(buf);
    expect(entry.byteLength).toBe(4);
  });

  test('createCacheEntry defaults statusCode to 200', () => {
    const entry = createCacheEntry('https://example.com/', 'body', 'text/html');
    expect(entry.statusCode).toBe(200);
  });

  test('decodeCacheEntry preserves headers', () => {
    const headers = { 'content-type': 'application/json', 'x-custom': 'val' };
    const entry = createCacheEntry(
      'https://example.com/data',
      '{}',
      'application/json',
      200,
      headers
    );
    const decoded = decodeCacheEntry(entry);
    expect(decoded.headers['content-type']).toBe('application/json');
    expect(decoded.headers['x-custom']).toBe('val');
    expect(Buffer.isBuffer(decoded.body)).toBe(true);
  });

  test('decodeCacheEntry preserves Buffer body reference', () => {
    const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
    const entry = createCacheEntry('https://example.com/binary', buf, 'application/octet-stream');
    const decoded = decodeCacheEntry(entry);
    expect(decoded.body).toBe(buf);
  });
});
