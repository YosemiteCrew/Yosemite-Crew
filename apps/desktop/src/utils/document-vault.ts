'use strict';

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const VAULT_DIR = 'document-vault';
export const MANIFEST_FILE = 'manifest.json';
export const MAX_BUFFER_SIZE_BYTES = 50 * 1024 * 1024;

export interface VaultDocument {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
  updatedAt: number;
  encoding?: 'base64';
}

export interface VaultFindQuery {
  filename?: string;
  mimeType?: string;
}

export interface VaultManifest {
  documents: VaultDocument[];
}

interface VaultDeps {
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  unlinkSync?: typeof fs.unlinkSync;
  randomUUID?: () => string;
  encryptString?: (plain: string) => Buffer;
  decryptString?: (encrypted: Buffer) => string;
}

const readManifest = (manifestPath: string, deps: VaultDeps): VaultManifest => {
  const readFileSync = deps.readFileSync || fs.readFileSync;
  try {
    const raw = readFileSync(manifestPath, 'utf8');
    return JSON.parse(raw) as VaultManifest;
  } catch {
    return { documents: [] };
  }
};

const writeManifest = (manifestPath: string, manifest: VaultManifest, deps: VaultDeps): void => {
  const writeFileSync = deps.writeFileSync || fs.writeFileSync;
  const mkdirSync = deps.mkdirSync || fs.mkdirSync;
  try {
    mkdirSync(path.dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  } catch {
    // vault must never break the app
  }
};

const docFilePath = (vaultDir: string, docId: string): string =>
  path.join(vaultDir, `${docId}.enc`);

export const createDocumentVault = (userDataPath: string, deps: VaultDeps = {}) => {
  const vaultDir = path.join(userDataPath, VAULT_DIR);
  const manifestPath = path.join(vaultDir, MANIFEST_FILE);
  const readFileSync = deps.readFileSync || fs.readFileSync;
  const writeFileSync = deps.writeFileSync || fs.writeFileSync;
  const unlinkSync = deps.unlinkSync || fs.unlinkSync;
  const mkdirSync = deps.mkdirSync || fs.mkdirSync;
  const randomUUID = deps.randomUUID || (() => crypto.randomUUID());
  const encryptString = deps.encryptString || ((s: string) => Buffer.from(s, 'utf8'));
  const decryptString = deps.decryptString || ((b: Buffer) => b.toString('utf8'));

  const getManifest = (): VaultManifest => readManifest(manifestPath, deps);

  const crossReference = (manifest: VaultManifest): VaultManifest => {
    const valid: VaultDocument[] = [];
    for (const doc of manifest.documents) {
      try {
        if (readFileSync(docFilePath(vaultDir, doc.id)).length > 0) {
          valid.push(doc);
        }
      } catch {
        // file missing — orphan, skip it
      }
    }
    if (valid.length !== manifest.documents.length) {
      writeManifest(manifestPath, { documents: valid }, deps);
    }
    return { documents: valid };
  };

  const listDocuments = (): VaultDocument[] => {
    const manifest = getManifest();
    const cleaned = crossReference(manifest);
    return cleaned.documents;
  };

  const getDocument = (id: string): { doc: VaultDocument; content: string } | null => {
    const manifest = getManifest();
    const doc = manifest.documents.find((d) => d.id === id);
    if (!doc) return null;
    try {
      const encrypted = readFileSync(docFilePath(vaultDir, id));
      const decoded = decryptString(encrypted);
      const content =
        doc.encoding === 'base64' ? Buffer.from(decoded, 'base64').toString('binary') : decoded;
      return { doc, content };
    } catch {
      return null;
    }
  };

  const saveDocument = (filename: string, content: string, mimeType?: string): VaultDocument => {
    const manifest = getManifest();
    mkdirSync(vaultDir, { recursive: true });
    const now = Date.now();
    const doc: VaultDocument = {
      id: randomUUID(),
      filename,
      mimeType: mimeType || 'application/octet-stream',
      sizeBytes: Buffer.byteLength(content, 'utf8'),
      createdAt: now,
      updatedAt: now,
    };
    const encrypted = encryptString(content);
    writeFileSync(docFilePath(vaultDir, doc.id), encrypted);
    manifest.documents.push(doc);
    writeManifest(manifestPath, manifest, deps);
    return doc;
  };

  const saveDocumentBuffer = (
    filename: string,
    content: Buffer,
    mimeType?: string
  ): VaultDocument | { ok: false; error: string } => {
    if (content.length > MAX_BUFFER_SIZE_BYTES) {
      return { ok: false, error: 'file-too-large' };
    }
    const manifest = getManifest();
    mkdirSync(vaultDir, { recursive: true });
    const now = Date.now();
    const doc: VaultDocument = {
      id: randomUUID(),
      filename,
      mimeType: mimeType || 'application/octet-stream',
      sizeBytes: content.length,
      createdAt: now,
      updatedAt: now,
      encoding: 'base64',
    };
    const encoded = content.toString('base64');
    const encrypted = encryptString(encoded);
    writeFileSync(docFilePath(vaultDir, doc.id), encrypted);
    manifest.documents.push(doc);
    writeManifest(manifestPath, manifest, deps);
    return doc;
  };

  const getDocumentBuffer = (id: string): { doc: VaultDocument; content: Buffer } | null => {
    const manifest = getManifest();
    const doc = manifest.documents.find((d) => d.id === id);
    if (!doc) return null;
    try {
      const encrypted = readFileSync(docFilePath(vaultDir, id));
      const decoded = decryptString(encrypted);
      const content =
        doc.encoding === 'base64' ? Buffer.from(decoded, 'base64') : Buffer.from(decoded, 'utf8');
      return { doc, content };
    } catch {
      return null;
    }
  };

  const deleteDocument = (id: string): boolean => {
    const manifest = getManifest();
    const idx = manifest.documents.findIndex((d) => d.id === id);
    if (idx < 0) return false;
    manifest.documents.splice(idx, 1);
    try {
      unlinkSync(docFilePath(vaultDir, id));
    } catch {
      // file may already be missing
    }
    writeManifest(manifestPath, manifest, deps);
    return true;
  };

  const findDocuments = (query: VaultFindQuery): VaultDocument[] => {
    const docs = listDocuments();
    return docs.filter((d) => {
      if (query.filename && !d.filename.toLowerCase().includes(query.filename.toLowerCase())) {
        return false;
      }
      if (query.mimeType && d.mimeType !== query.mimeType) {
        return false;
      }
      return true;
    });
  };

  const getStats = (): { count: number; totalSizeBytes: number } => {
    const docs = listDocuments();
    return {
      count: docs.length,
      totalSizeBytes: docs.reduce((sum, d) => sum + d.sizeBytes, 0),
    };
  };

  return {
    listDocuments,
    getDocument,
    saveDocument,
    saveDocumentBuffer,
    getDocumentBuffer,
    deleteDocument,
    findDocuments,
    getStats,
  };
};

export type DocumentVault = ReturnType<typeof createDocumentVault>;
