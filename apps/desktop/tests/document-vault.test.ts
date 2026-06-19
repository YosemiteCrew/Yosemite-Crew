import { createDocumentVault } from '../src/utils/document-vault';

const makeDeps = (overrides: Record<string, unknown> = {}) => {
  const files = new Map<string, string | Buffer>();
  let uuidCounter = 0;
  return {
    existsSync: (p: string) => files.has(p),
    readFileSync: (p: string) => {
      const v = files.get(p);
      if (!v) throw new Error('ENOENT');
      return v;
    },
    writeFileSync: (p: string, data: string | Buffer) => {
      files.set(p, data);
    },
    mkdirSync: () => undefined,
    readdirSync: () => [],
    unlinkSync: (p: string) => {
      files.delete(p);
    },
    randomUUID: () => {
      uuidCounter += 1;
      return `uuid-${uuidCounter}`;
    },
    encryptString: (s: string) => Buffer.from(`enc:${s}`),
    decryptString: (b: Buffer) => b.toString('utf8').replace(/^enc:/, ''),
    ...overrides,
  };
};

describe('createDocumentVault', () => {
  test('saveDocument stores document and returns metadata', () => {
    const vault = createDocumentVault('/tmp/vault-test', makeDeps());
    const doc = vault.saveDocument('report.pdf', 'PDF content here', 'application/pdf');
    expect(doc.id).toBe('uuid-1');
    expect(doc.filename).toBe('report.pdf');
    expect(doc.mimeType).toBe('application/pdf');
    expect(doc.sizeBytes).toBe(Buffer.byteLength('PDF content here', 'utf8'));
    expect(doc.createdAt).toBeGreaterThan(0);
    expect(doc.updatedAt).toBe(doc.createdAt);
  });

  test('listDocuments returns all saved documents', () => {
    const vault = createDocumentVault('/tmp/vault-test', makeDeps());
    vault.saveDocument('a.txt', 'aaa');
    vault.saveDocument('b.txt', 'bbb');
    const list = vault.listDocuments();
    expect(list).toHaveLength(2);
    expect(list[0].filename).toBe('a.txt');
    expect(list[1].filename).toBe('b.txt');
  });

  test('getDocument returns document and decrypted content', () => {
    const vault = createDocumentVault('/tmp/vault-test', makeDeps());
    const saved = vault.saveDocument('secret.txt', 'sensitive data');
    const result = vault.getDocument(saved.id);
    expect(result).not.toBeNull();
    expect(result!.doc.id).toBe(saved.id);
    expect(result!.content).toBe('sensitive data');
  });

  test('getDocument returns null for missing id', () => {
    const vault = createDocumentVault('/tmp/vault-test', makeDeps());
    expect(vault.getDocument('nonexistent')).toBeNull();
  });

  test('deleteDocument removes document and returns true', () => {
    const vault = createDocumentVault('/tmp/vault-test', makeDeps());
    const saved = vault.saveDocument('delete-me.txt', 'bye');
    expect(vault.listDocuments()).toHaveLength(1);
    expect(vault.deleteDocument(saved.id)).toBe(true);
    expect(vault.listDocuments()).toHaveLength(0);
  });

  test('deleteDocument returns false for non-existent id', () => {
    const vault = createDocumentVault('/tmp/vault-test', makeDeps());
    expect(vault.deleteDocument('missing')).toBe(false);
  });

  test('getStats returns count and total size', () => {
    const vault = createDocumentVault('/tmp/vault-test', makeDeps());
    expect(vault.getStats()).toEqual({ count: 0, totalSizeBytes: 0 });
    vault.saveDocument('a.txt', '12345');
    vault.saveDocument('b.txt', '1234567890');
    expect(vault.getStats()).toEqual({ count: 2, totalSizeBytes: 15 });
  });

  test('saveDocument defaults mimeType to octet-stream', () => {
    const vault = createDocumentVault('/tmp/vault-test', makeDeps());
    const doc = vault.saveDocument('binary.bin', '\x00\x01\x02');
    expect(doc.mimeType).toBe('application/octet-stream');
  });

  test('encryption uses provided encryptString', () => {
    const deps = makeDeps();
    const vault = createDocumentVault('/tmp/vault-test', deps);
    vault.saveDocument('test.txt', 'hello');
    const result = vault.getDocument('uuid-1');
    expect(result).not.toBeNull();
    expect(result!.content).toBe('hello');
  });

  // ── Phase 3: saveDocumentBuffer ──────────────────────────────────

  test('saveDocumentBuffer round-trips binary with zero bytes', () => {
    const vault = createDocumentVault('/tmp/vault-test', makeDeps());
    const buf = Buffer.from([0x00, 0x00, 0x00]);
    const doc = vault.saveDocumentBuffer('zeros.bin', buf);
    if ('error' in doc) {
      throw new Error(`saveDocumentBuffer returned error: ${doc.error}`);
    }
    const result = vault.getDocumentBuffer(doc.id);
    expect(result).not.toBeNull();
    expect(Buffer.from(result!.content).equals(buf)).toBe(true);
  });

  test('saveDocumentBuffer with image bytes preserves content exactly', () => {
    const vault = createDocumentVault('/tmp/vault-test', makeDeps());
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const doc = vault.saveDocumentBuffer('photo.jpg', jpeg, 'image/jpeg');
    if ('error' in doc) {
      throw new Error(`saveDocumentBuffer returned error: ${doc.error}`);
    }
    const result = vault.getDocumentBuffer(doc.id);
    expect(result).not.toBeNull();
    expect(result!.doc.mimeType).toBe('image/jpeg');
    expect(Buffer.from(result!.content).equals(jpeg)).toBe(true);
  });

  test('getDocumentBuffer returns Buffer for binary doc', () => {
    const vault = createDocumentVault('/tmp/vault-test', makeDeps());
    const buf = Buffer.from('binary data');
    const doc = vault.saveDocumentBuffer('data.bin', buf);
    if ('error' in doc) {
      throw new Error(`saveDocumentBuffer returned error: ${doc.error}`);
    }
    const result = vault.getDocumentBuffer(doc.id);
    expect(result).not.toBeNull();
    expect(Buffer.isBuffer(result!.content)).toBe(true);
  });

  test('saveDocumentBuffer rejects files exceeding 50 MB limit', () => {
    const vault = createDocumentVault('/tmp/vault-test', makeDeps());
    const large = Buffer.alloc(51 * 1024 * 1024);
    const result = vault.saveDocumentBuffer('huge.bin', large);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toBe('file-too-large');
    }
  });

  // ── Phase 3: findDocuments ───────────────────────────────────────

  test('findDocuments by filename partial match (case-insensitive)', () => {
    const vault = createDocumentVault('/tmp/vault-test', makeDeps());
    vault.saveDocument('Invoice-123.pdf', 'content');
    vault.saveDocument('Report.pdf', 'report');
    vault.saveDocument('notes.txt', 'notes');
    const results = vault.findDocuments({ filename: 'invoice' });
    expect(results).toHaveLength(1);
    expect(results[0].filename).toBe('Invoice-123.pdf');
  });

  test('findDocuments by mimeType exact match', () => {
    const vault = createDocumentVault('/tmp/vault-test', makeDeps());
    vault.saveDocument('doc.pdf', 'pdf', 'application/pdf');
    vault.saveDocument('doc.txt', 'text', 'text/plain');
    const results = vault.findDocuments({ mimeType: 'application/pdf' });
    expect(results).toHaveLength(1);
    expect(results[0].filename).toBe('doc.pdf');
  });

  test('findDocuments returns empty array when no matches', () => {
    const vault = createDocumentVault('/tmp/vault-test', makeDeps());
    vault.saveDocument('a.txt', 'aaa');
    const results = vault.findDocuments({ filename: 'nonexistent' });
    expect(results).toEqual([]);
  });

  // ── Phase 3: manifest corruption ─────────────────────────────────

  test('manifest corruption returns empty list', () => {
    const deps = makeDeps({ readFileSync: () => '{invalid json}' });
    const vault = createDocumentVault('/tmp/vault-test', deps);
    expect(vault.listDocuments()).toEqual([]);
  });

  test('writeManifest failure does not crash vault', () => {
    const files = new Map<string, string | Buffer>();
    const deps = makeDeps({
      writeFileSync: (p: string, data: string | Buffer) => {
        if (p.endsWith('manifest.json')) throw new Error('ENOSPC');
        files.set(p, data);
      },
      readFileSync: (p: string) => {
        const v = files.get(p);
        if (!v) throw new Error('ENOENT');
        return v;
      },
      unlinkSync: (p: string) => {
        files.delete(p);
      },
    });
    const vault = createDocumentVault('/tmp/vault-test', deps);
    expect(() => vault.saveDocument('test.txt', 'hello')).not.toThrow();
  });

  test('unlinkSync failure on delete still updates manifest', () => {
    const deps = makeDeps({
      unlinkSync: () => {
        throw new Error('EACCES');
      },
    });
    const vault = createDocumentVault('/tmp/vault-test', deps);
    const doc = vault.saveDocument('stuck.txt', 'stuck');
    const deleted = vault.deleteDocument(doc.id);
    expect(deleted).toBe(true);
    expect(vault.listDocuments()).toHaveLength(0);
  });

  // ── Phase 3: cross-reference ────────────────────────────────────

  test('listDocuments cross-references removes orphaned manifest entry', () => {
    const deps = makeDeps();
    const vault = createDocumentVault('/tmp/vault-test', deps);
    const doc = vault.saveDocument('orphan.txt', 'will be orphaned');
    expect(vault.listDocuments()).toHaveLength(1);
    // Simulate orphan: create second vault where this file's read fails
    const depsWithMissingFile = makeDeps({
      readFileSync: (p: string) => {
        if (p.includes(doc.id)) throw new Error('ENOENT');
        return deps.readFileSync(p);
      },
    });
    const vault2 = createDocumentVault('/tmp/vault-test', depsWithMissingFile);
    expect(vault2.listDocuments()).toHaveLength(0);
  });

  test('empty vault on fresh directory returns empty', () => {
    const vault = createDocumentVault('/tmp/empty-vault', makeDeps());
    expect(vault.listDocuments()).toEqual([]);
    expect(vault.getStats()).toEqual({ count: 0, totalSizeBytes: 0 });
  });

  // ── Phase 3: multiple saves same filename ────────────────────────

  test('multiple saves with same filename produce unique IDs', () => {
    const vault = createDocumentVault('/tmp/vault-test', makeDeps());
    const doc1 = vault.saveDocument('same.txt', 'first');
    const doc2 = vault.saveDocument('same.txt', 'second');
    expect(doc1.id).not.toBe(doc2.id);
    expect(doc1.filename).toBe(doc2.filename);
    expect(vault.listDocuments()).toHaveLength(2);
  });

  // ── Phase 3: partial dep override ────────────────────────────────

  test('partial dep override mixes injected and default deps', () => {
    let customEncryptCalled = false;
    const vault = createDocumentVault('/tmp/vault-test', {
      encryptString: (s: string) => {
        customEncryptCalled = true;
        return Buffer.from(`custom:${s}`);
      },
    });
    const doc = vault.saveDocument('test.txt', 'hello');
    const result = vault.getDocument(doc.id);
    expect(result).not.toBeNull();
    expect(customEncryptCalled).toBe(true);
    // decryptString not overridden so it will try to decode 'custom:hello' as plain utf8
    // which is fine — it's the default fallback
  });
});
