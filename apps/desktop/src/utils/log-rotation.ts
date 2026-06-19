'use strict';

export interface LogRotationDeps {
  existsSync: (path: string) => boolean;
  statSync: (path: string) => { size: number };
  renameSync: (from: string, to: string) => void;
  unlinkSync: (path: string) => void;
}

export interface LogRotationOptions {
  filePath: string;
  maxBytes: number;
  maxFiles: number;
}

export const rotatedLogPath = (filePath: string, index: number): string => `${filePath}.${index}`;

export const shouldRotateLog = (
  filePath: string,
  maxBytes: number,
  deps: Pick<LogRotationDeps, 'existsSync' | 'statSync'>
): boolean => {
  if (maxBytes <= 0 || !deps.existsSync(filePath)) return false;
  return deps.statSync(filePath).size >= maxBytes;
};

export const rotateLogIfNeeded = (options: LogRotationOptions, deps: LogRotationDeps): boolean => {
  const maxFiles = Math.max(0, Math.floor(options.maxFiles));
  if (maxFiles === 0 || !shouldRotateLog(options.filePath, options.maxBytes, deps)) return false;

  const oldest = rotatedLogPath(options.filePath, maxFiles);
  if (deps.existsSync(oldest)) deps.unlinkSync(oldest);

  for (let index = maxFiles - 1; index >= 1; index -= 1) {
    const current = rotatedLogPath(options.filePath, index);
    if (deps.existsSync(current))
      deps.renameSync(current, rotatedLogPath(options.filePath, index + 1));
  }

  deps.renameSync(options.filePath, rotatedLogPath(options.filePath, 1));
  return true;
};
