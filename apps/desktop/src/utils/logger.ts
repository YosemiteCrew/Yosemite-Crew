'use strict';

import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';
import { rotateLogIfNeeded } from './log-rotation';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface DesktopLogger {
  debug: (event: string, data?: unknown) => void;
  info: (event: string, data?: unknown) => void;
  warn: (event: string, data?: unknown) => void;
  error: (event: string, data?: unknown) => void;
}

interface LoggerOptions {
  logDir?: string;
  stdout?: boolean;
  now?: () => Date;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
}

const REDACTED = '[redacted]';
const SENSITIVE_KEY_PATTERN =
  /(token|secret|password|cookie|authorization|signature|credential|key)/i;

const sanitize = (value: unknown, depth = 0): unknown => {
  if (depth > 5) return '[max-depth]';
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > 1000 ? `${value.slice(0, 1000)}...` : value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((entry) => sanitize(entry, depth + 1));

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : sanitize(entry, depth + 1);
  }
  return output;
};

const createLogRecord = (level: LogLevel, event: string, data: unknown, now: () => Date) => ({
  timestamp: now().toISOString(),
  level,
  event,
  data: sanitize(data),
});

export const createLogger = (options: LoggerOptions = {}): DesktopLogger => {
  const now = options.now || (() => new Date());
  const stdout = options.stdout ?? process.env.YC_DESKTOP_LOG_STDOUT === '1';
  const writeFileSync = options.writeFileSync || fs.writeFileSync;
  const mkdirSync = options.mkdirSync || fs.mkdirSync;
  const logFile = options.logDir ? path.join(options.logDir, 'desktop.log') : null;

  const write = (level: LogLevel, event: string, data?: unknown): void => {
    const record = createLogRecord(level, event, data, now);
    const line = `${JSON.stringify(record)}\n`;

    if (logFile) {
      try {
        mkdirSync(path.dirname(logFile), { recursive: true });
        rotateLogIfNeeded(
          { filePath: logFile, maxBytes: 5_242_880, maxFiles: 3 },
          {
            existsSync: fs.existsSync,
            statSync: fs.statSync,
            renameSync: fs.renameSync,
            unlinkSync: fs.unlinkSync,
          }
        );
        writeFileSync(logFile, line, { flag: 'a', encoding: 'utf8' });
      } catch {
        // Logging must never break the app runtime.
      }
    }

    if (stdout) {
      let writer = console.log;
      if (level === 'error') writer = console.error;
      else if (level === 'warn') writer = console.warn;
      writer(util.format('%s %s', level.toUpperCase(), line.trim()));
    }
  };

  return {
    debug: (event, data) => write('debug', event, data),
    info: (event, data) => write('info', event, data),
    warn: (event, data) => write('warn', event, data),
    error: (event, data) => write('error', event, data),
  };
};

export const loggerTestExports = {
  sanitize,
  createLogRecord,
};
