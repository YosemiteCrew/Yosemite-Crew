'use strict';

import fs from 'node:fs';
import path from 'node:path';

export interface BackupOptions {
  sourcePaths: string[];
  destinationDir: string;
  maxBackups: number;
  encrypt?: boolean;
  compressionLevel?: number;
}

export interface BackupResult {
  id: string;
  timestamp: number;
  path: string;
  size: number;
  fileCount: number;
  success: boolean;
  error?: string;
}

export interface BackupSchedule {
  enabled: boolean;
  intervalMs: number;
  lastRun?: number;
  nextRun?: number;
}

export interface BackupService {
  createBackup: (options: BackupOptions) => Promise<BackupResult>;
  listBackups: (destinationDir: string) => BackupResult[];
  deleteBackup: (backupPath: string) => boolean;
  pruneOldBackups: (destinationDir: string, maxBackups: number) => number;
  getSchedule: () => BackupSchedule;
  setSchedule: (schedule: BackupSchedule) => void;
}

interface BackupDeps {
  readdirSync?: typeof fs.readdirSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  existsSync?: typeof fs.existsSync;
  statSync?: typeof fs.statSync;
  unlinkSync?: typeof fs.unlinkSync;
  now?: () => number;
  encryptString?: (plain: string) => Buffer;
  createArchive?: (
    zipPath: string,
    files: { srcPath: string; relativePath: string }[],
    compressionLevel: number
  ) => Promise<void>;
}

let backupCounter = 0;
const generateBackupId = (): string => `backup-${Date.now()}-${++backupCounter}`;

export const createBackupService = (deps: BackupDeps = {}): BackupService => {
  const readdirSync = deps.readdirSync || fs.readdirSync;
  const readFileSync = deps.readFileSync || fs.readFileSync;
  const writeFileSync = deps.writeFileSync || fs.writeFileSync;
  const mkdirSync = deps.mkdirSync || fs.mkdirSync;
  const existsSync = deps.existsSync || fs.existsSync;
  const statSync = deps.statSync || fs.statSync;
  const unlinkSync = deps.unlinkSync || fs.unlinkSync;
  const now = deps.now || (() => Date.now());
  const createArchive =
    deps.createArchive ||
    (async (
      zipPath: string,
      files: { srcPath: string; relativePath: string }[],
      compressionLevel: number
    ): Promise<void> => {
      const archiverMod = await import('archiver');
      const archiverFn = archiverMod.default || archiverMod;
      return new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiverFn('zip', {
          zlib: { level: compressionLevel },
        });
        output.on('close', resolve);
        archive.on('error', reject);
        archive.pipe(output);
        for (const f of files) {
          archive.file(f.srcPath, { name: f.relativePath });
        }
        void archive.finalize();
      });
    });

  let schedule: BackupSchedule = { enabled: false, intervalMs: 86400000 };

  const metaFilename = (destDir: string): string => path.join(destDir, '.backup-meta.json');

  const loadMeta = (destDir: string): BackupResult[] => {
    const mf = metaFilename(destDir);
    if (!existsSync(mf)) return [];
    try {
      const raw = readFileSync(mf, 'utf8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  };

  const saveMeta = (destDir: string, entries: BackupResult[]): void => {
    mkdirSync(destDir, { recursive: true });
    writeFileSync(metaFilename(destDir), JSON.stringify(entries, null, 2), 'utf8');
  };

  const collectFiles = (
    srcPaths: string[],
    excludeDir?: string
  ): { srcPath: string; relativePath: string }[] => {
    const files: { srcPath: string; relativePath: string }[] = [];
    // Never archive the backup destination itself, or each run would nest the
    // prior backups + metadata and grow without bound.
    const excludeResolved = excludeDir ? path.resolve(excludeDir) : null;

    // Recurse into subdirectories so nested stores (e.g. userData/document-vault
    // and the compliance directories) are included, not just immediate files.
    const walkDir = (dir: string, prefix: string): void => {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const relativePath = prefix ? path.posix.join(prefix, entry) : entry;
        try {
          const s = statSync(fullPath);
          if (s.isDirectory()) {
            if (excludeResolved && path.resolve(fullPath) === excludeResolved) continue;
            walkDir(fullPath, relativePath);
          } else if (s.isFile()) {
            files.push({ srcPath: fullPath, relativePath });
          }
        } catch {
          // skip broken symlinks, locked files, etc.
        }
      }
    };

    for (const srcPath of srcPaths) {
      if (!existsSync(srcPath)) continue;
      const stats = statSync(srcPath);
      if (stats.isDirectory()) {
        walkDir(srcPath, '');
      } else if (stats.isFile()) {
        files.push({ srcPath, relativePath: path.basename(srcPath) });
      }
    }
    return files;
  };

  const createBackup = async (options: BackupOptions): Promise<BackupResult> => {
    const id = generateBackupId();
    const timestamp = now();
    const zipPath = path.join(options.destinationDir, `${id}.zip`);

    try {
      mkdirSync(options.destinationDir, { recursive: true });

      const files = collectFiles(options.sourcePaths, options.destinationDir);
      const fileCount = files.length;

      await createArchive(zipPath, files, options.compressionLevel ?? 6);

      const stat = statSync(zipPath);
      let finalPath = zipPath;
      let finalSize = stat.size;

      if (options.encrypt && deps.encryptString) {
        const raw = readFileSync(zipPath);
        // base64 (not utf8) so the binary zip survives the string round-trip;
        // restore must base64-decode after decryptString.
        const encrypted = deps.encryptString(raw.toString('base64'));
        const encPath = path.join(options.destinationDir, `${id}.enc`);
        writeFileSync(encPath, encrypted);
        unlinkSync(zipPath);
        finalPath = encPath;
        finalSize = statSync(encPath).size;
      }

      const result: BackupResult = {
        id,
        timestamp,
        path: finalPath,
        size: finalSize,
        fileCount,
        success: true,
      };
      const meta = loadMeta(options.destinationDir);
      meta.push(result);
      saveMeta(options.destinationDir, meta);
      pruneOldBackups(options.destinationDir, options.maxBackups);
      return result;
    } catch (err) {
      // clean up partial archive
      try {
        if (existsSync(zipPath)) unlinkSync(zipPath);
      } catch {
        /* ok */
      }
      return {
        id,
        timestamp,
        path: zipPath,
        size: 0,
        fileCount: 0,
        success: false,
        error: String(err),
      };
    }
  };

  const listBackups = (destinationDir: string): BackupResult[] =>
    loadMeta(destinationDir).sort((a, b) => b.timestamp - a.timestamp);

  const deleteBackup = (backupPath: string): boolean => {
    try {
      if (!existsSync(backupPath)) return false;
      unlinkSync(backupPath);
      return true;
    } catch {
      return false;
    }
  };

  const pruneOldBackups = (destinationDir: string, maxBackups: number): number => {
    const meta = loadMeta(destinationDir);
    if (meta.length <= maxBackups) return 0;
    const sorted = [...meta].sort((a, b) => a.timestamp - b.timestamp);
    const toRemove = sorted.slice(0, meta.length - maxBackups);
    let removed = 0;
    for (const backup of toRemove) {
      if (deleteBackup(backup.path)) removed++;
    }
    const remaining = loadMeta(destinationDir).filter((b) => !toRemove.some((r) => r.id === b.id));
    saveMeta(destinationDir, remaining);
    return removed;
  };

  const getSchedule = (): BackupSchedule => ({ ...schedule });

  const setSchedule = (s: BackupSchedule): void => {
    schedule = { ...s, nextRun: s.enabled ? now() + s.intervalMs : undefined };
  };

  return {
    createBackup,
    listBackups,
    deleteBackup,
    pruneOldBackups,
    getSchedule,
    setSchedule,
  };
};
