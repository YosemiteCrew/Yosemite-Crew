import path from 'node:path';
import { Buffer } from 'node:buffer';

/**
 * In-memory filesystem covering the whole surface the compliance logs use,
 * including the append/fsync path. The previous mocks stubbed only
 * read/write/exists/mkdir, so any code reaching for openSync fell through to the
 * real disk and made the tests non-hermetic.
 *
 * Faults can be armed per path so that write failures (ENOSPC, EACCES, an
 * antivirus lock) are testable without touching a real filesystem.
 */
export interface MemoryFs {
  files: Map<string, string>;
  dirs: Set<string>;
  fsyncCalls: string[];
  /** Fail the next open of any path matching this predicate. */
  failOpen: (match: (filePath: string, flags: string) => boolean, code?: string) => void;
  /** Fail writes to any path matching this predicate. */
  failWrite: (match: (filePath: string) => boolean, code?: string) => void;
  /** Make writes to matching paths silently persist fewer bytes than asked. */
  truncateWrite: (match: (filePath: string) => boolean, keepBytes: number) => void;
  clearFaults: () => void;
  readFileSync: jest.Mock;
  writeFileSync: jest.Mock;
  mkdirSync: jest.Mock;
  existsSync: jest.Mock;
  openSync: jest.Mock;
  writeSync: jest.Mock;
  fsyncSync: jest.Mock;
  closeSync: jest.Mock;
  renameSync: jest.Mock;
  truncateSync: jest.Mock;
}

const enoent = (filePath: string, op: string): Error => {
  const err = new Error(`ENOENT: no such file or directory, ${op} '${filePath}'`) as Error & {
    code?: string;
  };
  err.code = 'ENOENT';
  return err;
};

const failure = (code: string, filePath: string, op: string): Error => {
  const err = new Error(`${code}: simulated failure, ${op} '${filePath}'`) as Error & {
    code?: string;
  };
  err.code = code;
  return err;
};

export const createMemoryFs = (seed: Record<string, string> = {}): MemoryFs => {
  const files = new Map<string, string>(Object.entries(seed));
  const dirs = new Set<string>();
  const fsyncCalls: string[] = [];
  const handles = new Map<number, string>();
  let nextFd = 10;

  let openFault: { match: (p: string, f: string) => boolean; code: string } | null = null;
  let writeFault: { match: (p: string) => boolean; code: string } | null = null;
  let shortWrite: { match: (p: string) => boolean; keepBytes: number } | null = null;

  // Seeded files imply their directories exist.
  for (const filePath of files.keys()) dirs.add(path.dirname(filePath));

  const addDir = (dirPath: string): void => {
    let current = dirPath;
    while (current && current !== path.dirname(current)) {
      dirs.add(current);
      current = path.dirname(current);
    }
    dirs.add(current);
  };

  const fs: MemoryFs = {
    files,
    dirs,
    fsyncCalls,
    failOpen: (match, code = 'EACCES') => {
      openFault = { match, code };
    },
    failWrite: (match, code = 'ENOSPC') => {
      writeFault = { match, code };
    },
    truncateWrite: (match, keepBytes) => {
      shortWrite = { match, keepBytes };
    },
    clearFaults: () => {
      openFault = null;
      writeFault = null;
      shortWrite = null;
    },

    readFileSync: jest.fn((filePath: string) => {
      const content = files.get(filePath);
      if (content === undefined) throw enoent(filePath, 'open');
      return content;
    }),

    writeFileSync: jest.fn((filePath: string, data: string) => {
      files.set(filePath, String(data));
      addDir(path.dirname(filePath));
    }),

    mkdirSync: jest.fn((dirPath: string) => {
      addDir(dirPath);
    }),

    existsSync: jest.fn((target: string) => files.has(target) || dirs.has(target)),

    openSync: jest.fn((filePath: string, flags: string) => {
      if (openFault?.match(filePath, flags)) throw failure(openFault.code, filePath, 'open');
      if (!dirs.has(path.dirname(filePath))) throw enoent(filePath, 'open');
      if (flags.includes('w') || !files.has(filePath)) files.set(filePath, '');
      const fd = nextFd++;
      handles.set(fd, filePath);
      return fd;
    }),

    writeSync: jest.fn((fd: number, data: string) => {
      const filePath = handles.get(fd);
      if (filePath === undefined) throw new Error(`EBADF: bad file descriptor ${fd}`);
      if (writeFault?.match(filePath)) throw failure(writeFault.code, filePath, 'write');
      const payload =
        shortWrite?.match(filePath) === true
          ? Buffer.from(data, 'utf8').subarray(0, shortWrite.keepBytes).toString('utf8')
          : data;
      files.set(filePath, (files.get(filePath) ?? '') + payload);
      return Buffer.byteLength(payload, 'utf8');
    }),

    fsyncSync: jest.fn((fd: number) => {
      const filePath = handles.get(fd);
      if (filePath === undefined) throw new Error(`EBADF: bad file descriptor ${fd}`);
      fsyncCalls.push(filePath);
    }),

    closeSync: jest.fn((fd: number) => {
      handles.delete(fd);
    }),

    renameSync: jest.fn((from: string, to: string) => {
      const content = files.get(from);
      if (content === undefined) throw enoent(from, 'rename');
      files.delete(from);
      files.set(to, content);
      addDir(path.dirname(to));
    }),

    truncateSync: jest.fn((filePath: string, length: number) => {
      const content = files.get(filePath);
      if (content === undefined) throw enoent(filePath, 'truncate');
      files.set(filePath, Buffer.from(content, 'utf8').subarray(0, length).toString('utf8'));
    }),
  };

  return fs;
};

/** The dependency subset the compliance stores accept. */
export const asDeps = (
  mem: MemoryFs,
  now: () => number = () => 1000
): {
  readFileSync: jest.Mock;
  writeFileSync: jest.Mock;
  mkdirSync: jest.Mock;
  existsSync: jest.Mock;
  openSync: jest.Mock;
  writeSync: jest.Mock;
  fsyncSync: jest.Mock;
  closeSync: jest.Mock;
  renameSync: jest.Mock;
  truncateSync: jest.Mock;
  now: () => number;
} => ({
  readFileSync: mem.readFileSync,
  writeFileSync: mem.writeFileSync,
  mkdirSync: mem.mkdirSync,
  existsSync: mem.existsSync,
  openSync: mem.openSync,
  writeSync: mem.writeSync,
  fsyncSync: mem.fsyncSync,
  closeSync: mem.closeSync,
  renameSync: mem.renameSync,
  truncateSync: mem.truncateSync,
  now,
});

/** Reads a JSONL log back out of the memory filesystem. */
export const readJsonl = <T>(mem: MemoryFs, filePath: string): T[] =>
  (mem.files.get(filePath) ?? '')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as T);
